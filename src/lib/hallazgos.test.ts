import { beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "@/test/prisma"

vi.mock("@/lib/db", async () => (await import("@/test/prisma")).prismaModule)
vi.mock("@/lib/audit", () => ({ registrarEvento: vi.fn() }))
vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }))

import { asignar, cambiarEstado, comentar, estaVencido, leerFiltros, puedeGestionar, whereHallazgos } from "./hallazgos"

const lider = { id: 1, email: "l@postedin.com", nombre: "L", rol: "LIDER_TECNICO" as const }
const dev = { id: 2, email: "d@postedin.com", nombre: "D", rol: "DESARROLLADOR" as const }
const ctx = (actor: typeof lider | typeof dev) => ({ actor, ip: null })

beforeEach(() => resetPrismaMock())

describe("filtros", () => {
  it("ignora valores inválidos de la URL", () => {
    expect(leerFiltros({ repo: "abc", severidad: "-1", estado: "BORRADO", responsable: "x", q: " a ", pagina: "0" }))
      .toEqual({ repo: null, severidad: null, estado: null, responsable: null, q: "a", pagina: 1 })
  })

  it("arma el where con pendientes, responsable propio y texto", () => {
    const w = whereHallazgos(leerFiltros({ estado: "PENDIENTES", responsable: "yo", q: "token" }), dev)
    expect(w.AND).toEqual([
      { estado: { in: ["ABIERTO", "EN_PROGRESO"] } },
      { asignadoId: 2 },
      { OR: expect.any(Array) },
    ])
  })

  it("sin filtros no restringe", () => {
    expect(whereHallazgos(leerFiltros({}), lider)).toEqual({})
  })
})

describe("plazo", () => {
  it("vence solo si sigue pendiente después del plazo de su severidad", () => {
    const deteccion = new Date("2026-11-01T00:00:00Z")
    const ahora = new Date("2026-11-04T00:00:00Z")
    expect(estaVencido({ estado: "ABIERTO", fechaDeteccion: deteccion }, 2, ahora)).toBe(true)
    expect(estaVencido({ estado: "RESUELTO", fechaDeteccion: deteccion }, 2, ahora)).toBe(false)
    expect(estaVencido({ estado: "EN_PROGRESO", fechaDeteccion: deteccion }, 7, ahora)).toBe(false)
  })
})

describe("permisos sobre hallazgos", () => {
  it("el Desarrollador solo gestiona lo asignado a él", () => {
    expect(puedeGestionar(dev, { asignadoId: 2 })).toBe(true)
    expect(puedeGestionar(dev, { asignadoId: 9 })).toBe(false)
    expect(puedeGestionar(dev, { asignadoId: null })).toBe(false)
    expect(puedeGestionar(lider, { asignadoId: null })).toBe(true)
  })

  it("rechaza el cambio de estado de un hallazgo ajeno sin tocar la base", async () => {
    prismaMock.hallazgo.findUnique.mockResolvedValue({ id: 5, estado: "ABIERTO", asignadoId: 9 })
    const r = await cambiarEstado(ctx(dev), 5, { estado: "RESUELTO", justificacion: "" })
    expect(r).toEqual({ ok: false, error: "Solo puedes modificar hallazgos asignados a ti." })
    expect(prismaMock.hallazgo.update).not.toHaveBeenCalled()
  })

  it("falso positivo exige justificación y la deja como comentario", async () => {
    prismaMock.hallazgo.findUnique.mockResolvedValue({ id: 5, estado: "ABIERTO", asignadoId: 2 })
    expect((await cambiarEstado(ctx(dev), 5, { estado: "FALSO_POSITIVO", justificacion: "no" })).ok).toBe(false)
    const ahora = new Date("2026-11-10T00:00:00Z")
    expect((await cambiarEstado(ctx(dev), 5, { estado: "FALSO_POSITIVO", justificacion: "Es un valor de ejemplo en un test" }, ahora)).ok).toBe(true)
    expect(prismaMock.hallazgo.update.mock.calls[0][0].data).toEqual({ estado: "FALSO_POSITIVO", fechaCierre: ahora })
    expect(prismaMock.comentarioHallazgo.create.mock.calls[0][0].data.contenido).toBe("Falso positivo: Es un valor de ejemplo en un test")
  })

  it("reabrir limpia la fecha de cierre", async () => {
    prismaMock.hallazgo.findUnique.mockResolvedValue({ id: 5, estado: "RESUELTO", asignadoId: null })
    await cambiarEstado(ctx(lider), 5, { estado: "ABIERTO", justificacion: "" })
    expect(prismaMock.hallazgo.update.mock.calls[0][0].data.fechaCierre).toBeNull()
  })

  it("solo el Líder asigna, y solo a cuentas activas", async () => {
    expect((await asignar(ctx(dev), 5, 2)).ok).toBe(false)
    prismaMock.usuario.findUnique.mockResolvedValue({ activo: false })
    expect((await asignar(ctx(lider), 5, 3)).ok).toBe(false)
    prismaMock.usuario.findUnique.mockResolvedValue({ activo: true })
    prismaMock.hallazgo.findUnique.mockResolvedValue({ id: 5, asignadoId: null })
    expect((await asignar(ctx(lider), 5, 3)).ok).toBe(true)
    expect((await asignar(ctx(lider), 5, null)).ok).toBe(true)
  })

  it("avisa por correo solo a un responsable nuevo que no sea quien asigna", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ activo: true })
    const avisar = async (previo: number | null, nuevo: number | null) => {
      prismaMock.hallazgo.findUnique.mockResolvedValue({ id: 5, asignadoId: previo })
      const r = await asignar(ctx(lider), 5, nuevo)
      return r.ok && r.valor.avisar
    }
    expect(await avisar(null, 3)).toBe(true)
    expect(await avisar(3, 3)).toBe(false)
    expect(await avisar(3, null)).toBe(false)
    expect(await avisar(null, lider.id)).toBe(false)
  })

  it("comentar valida el texto", async () => {
    expect((await comentar(ctx(dev), 5, "   ")).ok).toBe(false)
    prismaMock.hallazgo.findUnique.mockResolvedValue({ id: 5 })
    expect((await comentar(ctx(dev), 5, "Ya roté la clave")).ok).toBe(true)
  })
})
