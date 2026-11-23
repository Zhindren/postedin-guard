import { describe, expect, it } from "vitest"
import {
  DURACION_MAXIMA_SESION_MS, INACTIVIDAD_MAXIMA_MS, bloqueadaHasta, correoPermitido, evaluarSesion,
} from "./reglas"

const ahora = new Date("2026-11-10T12:00:00Z")
const haceMin = (m: number) => new Date(ahora.getTime() - m * 60_000)

describe("bloqueadaHasta", () => {
  it("no bloquea con menos de 5 fallos recientes", () => {
    expect(bloqueadaHasta([haceMin(1), haceMin(2), haceMin(3), haceMin(4)], null, ahora)).toBeNull()
  })

  it("bloquea 15 minutos desde el último fallo al llegar a 5", () => {
    const hasta = bloqueadaHasta([haceMin(1), haceMin(2), haceMin(3), haceMin(4), haceMin(5)], null, ahora)
    expect(hasta?.toISOString()).toBe(new Date(haceMin(1).getTime() + 15 * 60_000).toISOString())
  })

  it("ignora fallos de hace más de 15 minutos", () => {
    expect(bloqueadaHasta([haceMin(1), haceMin(2), haceMin(16), haceMin(17), haceMin(18)], null, ahora)).toBeNull()
  })

  it("ignora fallos anteriores al último acceso exitoso", () => {
    const fallos = [haceMin(2), haceMin(3), haceMin(4), haceMin(5), haceMin(6)]
    expect(bloqueadaHasta(fallos, haceMin(3), ahora)).toBeNull()
  })
})

describe("evaluarSesion", () => {
  const t = ahora.getTime()
  const cuenta = { activo: true, versionSesion: 2 }

  it("vigente dentro de los límites", () => {
    expect(evaluarSesion({ inicio: t - 60_000, ultimaActividad: t - 1000, version: 2 }, cuenta, t)).toBe("vigente")
  })

  it("revocada si cambió la versión, la cuenta se desactivó o ya no existe", () => {
    expect(evaluarSesion({ inicio: t, ultimaActividad: t, version: 1 }, cuenta, t)).toBe("revocada")
    expect(evaluarSesion({ inicio: t, ultimaActividad: t, version: 2 }, { ...cuenta, activo: false }, t)).toBe("revocada")
    expect(evaluarSesion({ inicio: t, ultimaActividad: t, version: 2 }, null, t)).toBe("revocada")
  })

  it("inactiva tras 30 minutos sin uso", () => {
    expect(evaluarSesion({ inicio: t - 3600_000, ultimaActividad: t - INACTIVIDAD_MAXIMA_MS - 1, version: 2 }, cuenta, t)).toBe("inactiva")
  })

  it("expirada a las 8 horas aunque haya actividad", () => {
    expect(evaluarSesion({ inicio: t - DURACION_MAXIMA_SESION_MS - 1, ultimaActividad: t, version: 2 }, cuenta, t)).toBe("expirada")
  })
})

describe("correoPermitido", () => {
  it("acepta solo dominios configurados, sin importar mayúsculas", () => {
    expect(correoPermitido("ana@postedin.com", ["postedin.com"])).toBe(true)
    expect(correoPermitido("ana@PostedIn.com", ["postedin.com"])).toBe(true)
    expect(correoPermitido("ana@gmail.com", ["postedin.com"])).toBe(false)
    expect(correoPermitido("ana@postedin.com.evil.io", ["postedin.com"])).toBe(false)
    expect(correoPermitido("@postedin.com", ["postedin.com"])).toBe(false)
  })
})
