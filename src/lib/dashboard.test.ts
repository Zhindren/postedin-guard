import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", async () => (await import("@/test/prisma")).prismaModule)
vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }))

import { columnasPorSemana, inicioSemana, porcentaje, promedioDias } from "./dashboard"

describe("dashboard", () => {
  it("inicioSemana devuelve el lunes", () => {
    expect(inicioSemana(new Date("2026-11-12T15:00:00Z")).toISOString()).toBe("2026-11-09T00:00:00.000Z")
    expect(inicioSemana(new Date("2026-11-09T00:00:00Z")).toISOString()).toBe("2026-11-09T00:00:00.000Z")
    expect(inicioSemana(new Date("2026-11-15T23:00:00Z")).toISOString()).toBe("2026-11-09T00:00:00.000Z")
  })

  it("siempre devuelve 6 semanas, con ceros donde no hubo hallazgos", () => {
    const ahora = new Date("2026-11-12T00:00:00Z")
    const cols = columnasPorSemana([
      { semana: new Date("2026-11-09T00:00:00Z"), nivel: 4, n: 2 },
      { semana: new Date("2026-11-09T00:00:00Z"), nivel: 1, n: 1 },
      { semana: new Date("2026-10-05T00:00:00Z"), nivel: 3, n: 5 },
    ], ahora)
    expect(cols).toHaveLength(6)
    expect(cols.at(-1)).toMatchObject({ etiqueta: "09-11", total: 3, porNivel: { 1: 1, 2: 0, 3: 0, 4: 2 } })
    expect(cols[0]).toMatchObject({ etiqueta: "05-10", total: 5 })
  })

  it("porcentaje y promedio manejan el caso sin datos", () => {
    expect(porcentaje(0, 0)).toBeNull()
    expect(porcentaje(82, 100)).toBe(82)
    expect(porcentaje(1, 3)).toBe(33.3)
    expect(promedioDias([])).toBeNull()
    expect(promedioDias([
      { desde: new Date("2026-11-01T00:00:00Z"), hasta: new Date("2026-11-03T00:00:00Z") },
      { desde: new Date("2026-11-01T00:00:00Z"), hasta: new Date("2026-11-02T12:00:00Z") },
    ])).toBe(1.8)
  })
})
