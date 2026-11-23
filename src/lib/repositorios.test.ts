import { beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "@/test/prisma"

vi.mock("@/lib/db", async () => (await import("@/test/prisma")).prismaModule)
vi.mock("@/lib/audit", () => ({ registrarEvento: vi.fn() }))

import { sha256Hex } from "@/lib/tokens"
import { cambiarEstadoRepositorio, crearRepositorio, emitirToken } from "./repositorios"

const ctx = { actor: { id: 1, email: "lider@postedin.com", nombre: "Líder", rol: "LIDER_TECNICO" as const }, ip: null }
const datos = { nombre: "portal", urlGithub: "https://github.com/demo-guard/portal-demo", ramaPrincipal: "main", responsableId: "3" }

beforeEach(() => resetPrismaMock())

describe("crearRepositorio", () => {
  it("valida la URL de GitHub", async () => {
    expect((await crearRepositorio(ctx, { ...datos, urlGithub: "https://gitlab.com/a/b" })).ok).toBe(false)
    expect((await crearRepositorio(ctx, { ...datos, urlGithub: "https://github.com/a/b/../c" })).ok).toBe(false)
  })

  it("exige un responsable activo y evita duplicados", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ activo: false })
    expect(await crearRepositorio(ctx, datos)).toEqual({ ok: false, error: "El responsable debe ser una cuenta activa." })
    prismaMock.usuario.findUnique.mockResolvedValue({ activo: true })
    prismaMock.repositorio.findUnique.mockResolvedValue({ id: 2 })
    expect(await crearRepositorio(ctx, datos)).toEqual({ ok: false, error: "Ese repositorio ya está registrado." })
  })

  it("crea con el responsable convertido a número", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ activo: true })
    prismaMock.repositorio.findUnique.mockResolvedValue(null)
    prismaMock.repositorio.create.mockResolvedValue({ id: 4, urlGithub: datos.urlGithub })
    expect(await crearRepositorio(ctx, datos)).toEqual({ ok: true, valor: 4 })
    expect(prismaMock.repositorio.create.mock.calls[0][0].data.responsableId).toBe(3)
  })
})

describe("tokens de repositorio", () => {
  it("devuelve el token una vez y guarda solo su hash", async () => {
    prismaMock.repositorio.findUnique.mockResolvedValue({ id: 4, activo: true, tokenHash: null })
    const r = await emitirToken(ctx, 4)
    if (!r.ok) throw new Error(r.error)
    expect(r.valor.startsWith("pgr_")).toBe(true)
    expect(prismaMock.repositorio.update.mock.calls[0][0].data).toEqual({ tokenHash: sha256Hex(r.valor) })
  })

  it("no emite tokens para repositorios inactivos", async () => {
    prismaMock.repositorio.findUnique.mockResolvedValue({ id: 4, activo: false, tokenHash: null })
    expect((await emitirToken(ctx, 4)).ok).toBe(false)
  })

  it("desactivar revoca el token", async () => {
    await cambiarEstadoRepositorio(ctx, 4, false)
    expect(prismaMock.repositorio.update.mock.calls[0][0].data).toEqual({ activo: false, tokenHash: null })
  })
})
