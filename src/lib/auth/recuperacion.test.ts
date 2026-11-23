import { beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "@/test/prisma"

vi.mock("@/lib/db", async () => (await import("@/test/prisma")).prismaModule)
vi.mock("@/lib/audit", () => ({ registrarEvento: vi.fn() }))
vi.mock("@/lib/mail", () => ({ enviarCorreo: vi.fn().mockResolvedValue(true) }))

import { enviarCorreo } from "@/lib/mail"
import { sha256Hex } from "@/lib/tokens"
import { enlaceVigente, enviarInvitacion, restablecerPassword, solicitarRecuperacion } from "./recuperacion"

const ahora = new Date("2026-11-10T12:00:00Z")

beforeEach(() => {
  resetPrismaMock()
  vi.mocked(enviarCorreo).mockClear()
})

describe("enviarInvitacion", () => {
  it("informa si el correo salió, para que el Líder entregue el enlace a mano si no", async () => {
    const u = { id: 3, email: "ana@postedin.com", nombre: "Ana" }
    const enviado = await enviarInvitacion(u, ahora)
    expect(enviado.enviado).toBe(true)
    expect(enviado.enlace).toMatch(/^http:\/\/guard\.test\/restablecer\/\S+$/)
    expect(sha256Hex(enviado.enlace.split("/").pop()!)).toBe(prismaMock.usuario.update.mock.calls[0][0].data.resetHash)
    vi.mocked(enviarCorreo).mockResolvedValueOnce(false)
    expect((await enviarInvitacion(u, ahora)).enviado).toBe(false)
  })
})

describe("solicitarRecuperacion", () => {
  it("guarda solo el hash del token y envía el enlace", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 3, email: "ana@postedin.com", nombre: "Ana", activo: true })
    await solicitarRecuperacion("ana@postedin.com", null, ahora)
    const data = prismaMock.usuario.update.mock.calls[0][0].data
    expect(data.resetHash).toMatch(/^[0-9a-f]{64}$/)
    expect(data.resetExpira.getTime()).toBe(ahora.getTime() + 30 * 60_000)
    const texto = vi.mocked(enviarCorreo).mock.calls[0][0].texto
    const token = texto.match(/restablecer\/(\S+)/)![1]
    expect(sha256Hex(token)).toBe(data.resetHash)
    expect(texto).toContain("http://guard.test/restablecer/")
  })

  it("con un correo desconocido no envía nada ni lo revela", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null)
    await expect(solicitarRecuperacion("nadie@postedin.com", null, ahora)).resolves.toBeUndefined()
    expect(enviarCorreo).not.toHaveBeenCalled()
    expect(prismaMock.usuario.update).not.toHaveBeenCalled()
  })
})

describe("restablecerPassword", () => {
  const vigente = { id: 3, activo: true, resetExpira: new Date(ahora.getTime() + 60_000) }

  it("valida coincidencia y política de contraseña antes de tocar la base", async () => {
    expect(await restablecerPassword("t", "unaClaveSegura2026", "otra", null, ahora)).toEqual({ ok: false, error: "Las contraseñas no coinciden." })
    expect((await restablecerPassword("t", "corta", "corta", null, ahora)).ok).toBe(false)
    expect(prismaMock.usuario.findUnique).not.toHaveBeenCalled()
  })

  it("rechaza enlaces vencidos o inexistentes", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ ...vigente, resetExpira: new Date(ahora.getTime() - 1) })
    expect((await restablecerPassword("t", "unaClaveSegura2026", "unaClaveSegura2026", null, ahora)).ok).toBe(false)
    prismaMock.usuario.findUnique.mockResolvedValue(null)
    expect((await restablecerPassword("t", "unaClaveSegura2026", "unaClaveSegura2026", null, ahora)).ok).toBe(false)
  })

  it("cambia la clave, invalida el enlace y cierra las sesiones", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(vigente)
    expect(await restablecerPassword("t", "unaClaveSegura2026", "unaClaveSegura2026", null, ahora)).toEqual({ ok: true })
    const data = prismaMock.usuario.update.mock.calls[0][0].data
    expect(data.resetHash).toBeNull()
    expect(data.versionSesion).toEqual({ increment: 1 })
    expect(data.passwordHash).not.toBe("unaClaveSegura2026")
  })

  it("enlaceVigente busca por hash y respeta el vencimiento", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(vigente)
    expect(await enlaceVigente("abc", ahora)).toBe(true)
    expect(prismaMock.usuario.findUnique.mock.calls[0][0].where).toEqual({ resetHash: sha256Hex("abc") })
    expect(await enlaceVigente("", ahora)).toBe(false)
  })
})
