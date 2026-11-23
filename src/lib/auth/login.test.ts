import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "@/test/prisma"

vi.mock("@/lib/db", async () => (await import("@/test/prisma")).prismaModule)
vi.mock("@/lib/audit", () => ({ registrarEvento: vi.fn(), ipDesdeHeaders: () => null }))

import { registrarEvento } from "@/lib/audit"
import { hashPassword } from "./password"
import { autenticar } from "./login"

const ahora = new Date("2026-11-10T12:00:00Z")
let hash: string

beforeAll(async () => {
  hash = await hashPassword("unaClaveSegura2026")
})

function usuario(extra: Record<string, unknown> = {}) {
  return {
    id: 7, email: "ana@postedin.com", nombre: "Ana", apellido: "Soto", passwordHash: hash,
    activo: true, ultimoAcceso: null, versionSesion: 3, rol: { nombre: "DESARROLLADOR" }, ...extra,
  }
}

const acciones = () => vi.mocked(registrarEvento).mock.calls.map((c) => c[0].accion)

beforeEach(() => {
  resetPrismaMock()
  vi.mocked(registrarEvento).mockClear()
  prismaMock.bitacoraAuditoria.findMany.mockResolvedValue([])
})

describe("autenticar", () => {
  it("rechaza entradas mal formadas sin consultar la base", async () => {
    expect(await autenticar({ email: "no-es-correo", password: "x" }, null, ahora)).toEqual({ ok: false, motivo: "credenciales" })
    expect(prismaMock.usuario.findUnique).not.toHaveBeenCalled()
  })

  it("correo desconocido: falla genérica y queda en la bitácora", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null)
    const r = await autenticar({ email: "nadie@postedin.com", password: "algo" }, "1.2.3.4", ahora)
    expect(r).toEqual({ ok: false, motivo: "credenciales" })
    expect(acciones()).toEqual(["LOGIN_FALLIDO"])
  })

  it("contraseña correcta: devuelve el usuario y registra el acceso", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(usuario())
    const r = await autenticar({ email: "ANA@postedin.com ", password: "unaClaveSegura2026" }, null, ahora)
    expect(r).toEqual({
      ok: true,
      usuario: { id: "7", email: "ana@postedin.com", name: "Ana Soto", rol: "DESARROLLADOR", versionSesion: 3 },
    })
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { ultimoAcceso: ahora } })
    expect(acciones()).toEqual(["LOGIN_OK"])
  })

  it("contraseña incorrecta: falla y registra el intento", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(usuario())
    const r = await autenticar({ email: "ana@postedin.com", password: "otraClave20266" }, null, ahora)
    expect(r).toEqual({ ok: false, motivo: "credenciales" })
    expect(acciones()).toEqual(["LOGIN_FALLIDO"])
  })

  it("cuenta desactivada no entra aunque la clave sea correcta", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(usuario({ activo: false }))
    const r = await autenticar({ email: "ana@postedin.com", password: "unaClaveSegura2026" }, null, ahora)
    expect(r).toEqual({ ok: false, motivo: "credenciales" })
  })

  it("el quinto fallo bloquea la cuenta", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(usuario())
    prismaMock.bitacoraAuditoria.findMany.mockResolvedValue(
      [1, 2, 3, 4].map((m) => ({ fechaEvento: new Date(ahora.getTime() - m * 60_000) })),
    )
    const r = await autenticar({ email: "ana@postedin.com", password: "malaClave2026x" }, null, ahora)
    expect(r).toEqual({ ok: false, motivo: "bloqueada" })
    expect(acciones()).toEqual(["LOGIN_FALLIDO", "CUENTA_BLOQUEADA"])
  })

  it("con la cuenta bloqueada, ni la clave correcta entra", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(usuario())
    prismaMock.bitacoraAuditoria.findMany.mockResolvedValue(
      [1, 2, 3, 4, 5].map((m) => ({ fechaEvento: new Date(ahora.getTime() - m * 60_000) })),
    )
    const r = await autenticar({ email: "ana@postedin.com", password: "unaClaveSegura2026" }, null, ahora)
    expect(r).toEqual({ ok: false, motivo: "bloqueada" })
    expect(prismaMock.usuario.update).not.toHaveBeenCalled()
    expect(acciones()).toEqual(["LOGIN_BLOQUEADO"])
  })
})
