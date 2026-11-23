import { beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "@/test/prisma"

vi.mock("@/lib/db", async () => (await import("@/test/prisma")).prismaModule)
vi.mock("@/lib/audit", () => ({ registrarEvento: vi.fn() }))

import { asignarPoliticas, crearPolitica, editarPolitica } from "./politicas"

const ctx = { actor: { id: 1, email: "l@postedin.com", nombre: "L", rol: "LIDER_TECNICO" as const }, ip: null }
const datos = { nombre: "Estricta", descripcion: "", severidadBloqueoId: "2", coberturaMinima: "70,5", exigeChecklistIa: "on" }

beforeEach(() => resetPrismaMock())

describe("políticas", () => {
  it("convierte cobertura con coma decimal y la casilla del checklist", async () => {
    prismaMock.politicaSeguridad.findUnique.mockResolvedValue(null)
    prismaMock.politicaSeguridad.create.mockResolvedValue({ id: 3, nombre: "Estricta" })
    expect(await crearPolitica(ctx, datos)).toEqual({ ok: true, valor: 3 })
    expect(prismaMock.politicaSeguridad.create.mock.calls[0][0].data).toEqual({
      nombre: "Estricta", descripcion: null, severidadBloqueoId: 2, coberturaMinima: 70.5, exigeChecklistIa: true,
    })
  })

  it("rechaza cobertura fuera de rango y nombres repetidos", async () => {
    expect((await crearPolitica(ctx, { ...datos, coberturaMinima: "120" })).ok).toBe(false)
    prismaMock.politicaSeguridad.findUnique.mockResolvedValue({ id: 9 })
    expect(await editarPolitica(ctx, 3, datos)).toEqual({ ok: false, error: "Ya existe una política con ese nombre." })
  })

  it("cobertura vacía queda sin mínimo y la casilla ausente es falso", async () => {
    prismaMock.politicaSeguridad.findUnique.mockResolvedValue(null)
    prismaMock.politicaSeguridad.create.mockResolvedValue({ id: 4, nombre: "x" })
    await crearPolitica(ctx, { ...datos, coberturaMinima: "", exigeChecklistIa: "" })
    expect(prismaMock.politicaSeguridad.create.mock.calls[0][0].data).toMatchObject({ coberturaMinima: null, exigeChecklistIa: false })
  })

  it("asignar reemplaza las políticas del repositorio", async () => {
    prismaMock.politicaSeguridad.count.mockResolvedValue(2)
    expect((await asignarPoliticas(ctx, 1, [2, 3, 3])).ok).toBe(true)
    expect(prismaMock.repositorioPolitica.deleteMany).toHaveBeenCalledWith({ where: { repositorioId: 1, politicaId: { notIn: [2, 3] } } })
    prismaMock.politicaSeguridad.count.mockResolvedValue(1)
    expect((await asignarPoliticas(ctx, 1, [2, 99])).ok).toBe(false)
  })
})
