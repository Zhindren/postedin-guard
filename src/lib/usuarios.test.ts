import { beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "@/test/prisma"

vi.mock("@/lib/db", async () => (await import("@/test/prisma")).prismaModule)
vi.mock("@/lib/audit", () => ({ registrarEvento: vi.fn() }))
vi.mock("@/lib/auth/recuperacion", () => ({ enviarInvitacion: vi.fn() }))

import { enviarInvitacion } from "@/lib/auth/recuperacion"
import { hashPassword } from "@/lib/auth/password"
import { actualizarPerfil, cambiarEstadoUsuario, cambiarPassword, crearUsuario, editarUsuario } from "./usuarios"

const ctx = { actor: { id: 1, email: "lider@postedin.com", nombre: "Líder", rol: "LIDER_TECNICO" as const }, ip: null }
const nuevo = { nombre: "Diego", apellido: "Soto", email: "Diego@Postedin.com", rol: "DESARROLLADOR", usuarioGithub: "dsoto" }

beforeEach(() => {
  resetPrismaMock()
  vi.mocked(enviarInvitacion).mockReset().mockResolvedValue({ enlace: "http://guard.test/restablecer/abc", enviado: true })
  prismaMock.rol.findUniqueOrThrow.mockResolvedValue({ id: 2 })
})

describe("crearUsuario", () => {
  it("crea la cuenta sin clave conocida y envía la invitación", async () => {
    prismaMock.usuario.create.mockResolvedValue({ id: 9, email: "diego@postedin.com", nombre: "Diego" })
    const r = await crearUsuario(ctx, nuevo)
    expect(r).toEqual({ ok: true, valor: { id: 9, enlace: null } })
    const data = prismaMock.usuario.create.mock.calls[0][0].data
    expect(data.email).toBe("diego@postedin.com")
    expect(data.passwordHash).toMatch(/^\$2[aby]\$/)
    expect(enviarInvitacion).toHaveBeenCalledOnce()
  })

  it("sin correo configurado devuelve el enlace para entregarlo a mano", async () => {
    prismaMock.usuario.create.mockResolvedValue({ id: 9, email: "diego@postedin.com", nombre: "Diego" })
    vi.mocked(enviarInvitacion).mockResolvedValue({ enlace: "http://guard.test/restablecer/abc", enviado: false })
    expect(await crearUsuario(ctx, nuevo)).toEqual({ ok: true, valor: { id: 9, enlace: "http://guard.test/restablecer/abc" } })
  })

  it("rechaza dominios no permitidos", async () => {
    const r = await crearUsuario(ctx, { ...nuevo, email: "diego@gmail.com" })
    expect(r.ok).toBe(false)
    expect(prismaMock.usuario.create).not.toHaveBeenCalled()
  })

  it("traduce el correo duplicado a un mensaje claro", async () => {
    prismaMock.usuario.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }))
    expect(await crearUsuario(ctx, nuevo)).toEqual({ ok: false, error: "Ya existe una cuenta con ese correo o usuario de GitHub." })
  })

  it("valida el usuario de GitHub", async () => {
    const r = await crearUsuario(ctx, { ...nuevo, usuarioGithub: "no válido!" })
    expect(r.ok).toBe(false)
  })
})

describe("modo demo", () => {
  it("protege las cuentas @demo.test de cambios de clave, edición y desactivación", async () => {
    process.env.GUARD_DEMO = "1"
    try {
      const demo = { id: 5, email: "dev1@demo.test", activo: true, rol: { nombre: "DESARROLLADOR" }, passwordHash: await hashPassword("claveActual2026x") }
      prismaMock.usuario.findUnique.mockResolvedValue(demo)
      expect(await cambiarEstadoUsuario(ctx, 5, false)).toMatchObject({ ok: false })
      expect(await editarUsuario(ctx, 5, { nombre: "X", apellido: "Y", rol: "LIDER_TECNICO", usuarioGithub: "" })).toMatchObject({ ok: false })
      expect(await cambiarPassword({ ...ctx, actor: { ...ctx.actor, id: 5 } }, "claveActual2026x", "claveNueva2026xx", "claveNueva2026xx")).toMatchObject({ ok: false })
      expect(prismaMock.usuario.update).not.toHaveBeenCalled()
    } finally {
      delete process.env.GUARD_DEMO
    }
  })
})

describe("editarUsuario y cambiarEstadoUsuario", () => {
  it("no deja sin Líder Técnico activo al quitarle el perfil al último", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 5, activo: true, rol: { nombre: "LIDER_TECNICO" } })
    prismaMock.usuario.count.mockResolvedValue(0)
    const r = await editarUsuario(ctx, 5, { nombre: "A", apellido: "B", usuarioGithub: "", rol: "DESARROLLADOR" })
    expect(r).toEqual({ ok: false, error: "Debe quedar al menos un Líder Técnico activo." })
  })

  it("nadie puede desactivarse a sí mismo", async () => {
    expect((await cambiarEstadoUsuario(ctx, 1, false)).ok).toBe(false)
  })

  it("desactivar sube la versión de sesión para cerrar sus sesiones", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 5, activo: true, rol: { nombre: "DESARROLLADOR" } })
    expect((await cambiarEstadoUsuario(ctx, 5, false)).ok).toBe(true)
    expect(prismaMock.usuario.update.mock.calls[0][0].data.versionSesion).toEqual({ increment: 1 })
  })
})

describe("perfil", () => {
  it("actualiza solo los datos propios", async () => {
    await actualizarPerfil(ctx, { nombre: "Sergio", apellido: "M", usuarioGithub: "smaldonado" })
    expect(prismaMock.usuario.update.mock.calls[0][0].where).toEqual({ id: 1 })
  })

  it("cambiar la clave exige la actual y cierra las sesiones", async () => {
    const hash = await hashPassword("claveActual2026x")
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 1, passwordHash: hash })
    expect((await cambiarPassword(ctx, "incorrecta", "claveNueva2026xx", "claveNueva2026xx")).ok).toBe(false)
    expect(prismaMock.usuario.update).not.toHaveBeenCalled()
    expect((await cambiarPassword(ctx, "claveActual2026x", "claveNueva2026xx", "claveNueva2026xx")).ok).toBe(true)
    expect(prismaMock.usuario.update.mock.calls[0][0].data.versionSesion).toEqual({ increment: 1 })
  })

  it("la nueva clave debe ser distinta y cumplir la política", async () => {
    const hash = await hashPassword("claveActual2026x")
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 1, passwordHash: hash })
    expect((await cambiarPassword(ctx, "claveActual2026x", "claveActual2026x", "claveActual2026x")).ok).toBe(false)
    expect((await cambiarPassword(ctx, "claveActual2026x", "corta", "corta")).ok).toBe(false)
  })
})
