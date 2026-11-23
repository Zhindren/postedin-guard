import { beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "@/test/prisma"

vi.mock("@/lib/db", async () => (await import("@/test/prisma")).prismaModule)
vi.mock("@/lib/audit", () => ({ registrarEvento: vi.fn() }))
vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }))

import { guardarChecklist, leerRespuestas, reevaluarEscaneo } from "./escaneos"

const ctx = { actor: { id: 2, email: "d@postedin.com", nombre: "D", rol: "DESARROLLADOR" as const }, ip: null }
const politicaIA = [{ politica: { nombre: "IA", coberturaMinima: null, exigeChecklistIa: true, severidadBloqueo: { nivel: 3, nombre: "Alta" } } }]

beforeEach(() => {
  resetPrismaMock()
  prismaMock.escaneo.findUnique.mockResolvedValue({ id: 10 })
  prismaMock.escaneo.findUniqueOrThrow.mockResolvedValue({ repositorioId: 1, resultadoAnalisis: "APROBADO" })
  prismaMock.itemChecklist.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }])
  prismaMock.repositorioPolitica.findMany.mockResolvedValue(politicaIA)
  prismaMock.itemChecklist.count.mockResolvedValue(2)
})

describe("leerRespuestas", () => {
  it("convierte si/no y deja null lo no respondido", () => {
    const fd = new FormData()
    fd.set("cumple_1", "si")
    fd.set("cumple_2", "no")
    fd.set("obs_2", "falta test")
    expect(leerRespuestas(fd, [1, 2, 3])).toEqual([
      { itemId: 1, cumple: true, observacion: "" },
      { itemId: 2, cumple: false, observacion: "falta test" },
      { itemId: 3, cumple: null, observacion: "" },
    ])
  })
})

describe("guardarChecklist", () => {
  it("exige responder todos los ítems activos", async () => {
    const r = await guardarChecklist(ctx, 10, [{ itemId: 1, cumple: true, observacion: "" }, { itemId: 2, cumple: null, observacion: "" }])
    expect(r).toEqual({ ok: false, error: "Responde todos los ítems del checklist." })
  })

  it("un 'no cumple' necesita observación", async () => {
    const r = await guardarChecklist(ctx, 10, [{ itemId: 1, cumple: true, observacion: "" }, { itemId: 2, cumple: false, observacion: "" }])
    expect(r.ok).toBe(false)
  })

  it("al completarlo, un análisis aprobado pasa a APROBADO", async () => {
    prismaMock.respuestaChecklist.count.mockResolvedValue(2)
    const r = await guardarChecklist(ctx, 10, [
      { itemId: 1, cumple: true, observacion: "" }, { itemId: 2, cumple: false, observacion: "Sin pruebas e2e todavía" },
    ])
    expect(r).toEqual({ ok: true, valor: "APROBADO" })
    expect(prismaMock.escaneo.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { resultado: "APROBADO" } })
  })
})

describe("reevaluarEscaneo", () => {
  it("el checklist no destraba un análisis bloqueado por hallazgos", async () => {
    prismaMock.escaneo.findUniqueOrThrow.mockResolvedValue({ repositorioId: 1, resultadoAnalisis: "BLOQUEADO" })
    prismaMock.respuestaChecklist.count.mockResolvedValue(2)
    expect(await reevaluarEscaneo(10)).toBe("BLOQUEADO")
  })

  it("un escaneo con error se queda en ERROR", async () => {
    prismaMock.escaneo.findUniqueOrThrow.mockResolvedValue({ repositorioId: 1, resultadoAnalisis: "ERROR" })
    expect(await reevaluarEscaneo(10)).toBe("ERROR")
    expect(prismaMock.escaneo.update).not.toHaveBeenCalled()
  })
})
