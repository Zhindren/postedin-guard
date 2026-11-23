import { beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "@/test/prisma"

vi.mock("@/lib/db", async () => (await import("@/test/prisma")).prismaModule)
vi.mock("@/lib/audit", () => ({ registrarEvento: vi.fn() }))

import { sha256Hex } from "@/lib/tokens"
import { MOTIVO_SIN_PRUEBAS } from "@/lib/gate"
import { procesarIngesta, repositorioPorToken } from "./procesar"
import type { PayloadIngesta } from "./esquema"

const H = (c: string) => c.repeat(64)
const hallazgo = (huella: string, severidad: "Crítica" | "Alta" | "Media" | "Baja" = "Alta") => ({
  herramienta: "Semgrep" as const, categoria: "Código inseguro", severidad, titulo: "t", descripcion: null,
  rutaArchivo: "a.ts", linea: 1, regla: "r", huella,
})
const payload = (extra: Partial<PayloadIngesta> = {}): PayloadIngesta => ({
  commitSha: "c".repeat(40), ramaOrigen: "feature/x", numeroPr: 4, autorGithub: "dsoto", urlEjecucion: null,
  herramientasEjecutadas: ["Semgrep", "Vitest"], pruebasFallidas: 0, pruebasTotales: null, cobertura: null, hallazgos: [], ...extra,
})
const repo = { id: 1, ramaPrincipal: "main" }

beforeEach(() => {
  resetPrismaMock()
  prismaMock.categoriaHallazgo.findMany.mockResolvedValue([{ id: 5, nombre: "Código inseguro" }])
  prismaMock.severidad.findMany.mockResolvedValue([
    { id: 1, nombre: "Crítica", nivel: 4 }, { id: 2, nombre: "Alta", nivel: 3 }, { id: 3, nombre: "Media", nivel: 2 }, { id: 4, nombre: "Baja", nivel: 1 },
  ])
  prismaMock.herramienta.findMany.mockResolvedValue([{ id: 3, nombre: "Semgrep" }])
  prismaMock.repositorioPolitica.findMany.mockResolvedValue([{
    politica: { nombre: "Base", coberturaMinima: null, exigeChecklistIa: false, severidadBloqueo: { nivel: 3, nombre: "Alta" } },
  }])
  prismaMock.hallazgo.findMany.mockResolvedValue([])
  prismaMock.escaneo.upsert.mockResolvedValue({ id: 10 })
  prismaMock.itemChecklist.count.mockResolvedValue(6)
  prismaMock.respuestaChecklist.count.mockResolvedValue(0)
  prismaMock.hallazgo.updateMany.mockResolvedValue({ count: 0 })
})

describe("repositorioPorToken", () => {
  it("busca por hash y rechaza repositorios inactivos o tokens sin prefijo", async () => {
    prismaMock.repositorio.findUnique.mockResolvedValue({ id: 1, activo: true, ramaPrincipal: "main" })
    expect(await repositorioPorToken("pgr_abc")).toEqual({ id: 1, ramaPrincipal: "main" })
    expect(prismaMock.repositorio.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: sha256Hex("pgr_abc") })
    prismaMock.repositorio.findUnique.mockResolvedValue({ id: 1, activo: false, ramaPrincipal: "main" })
    expect(await repositorioPorToken("pgr_abc")).toBeNull()
    expect(await repositorioPorToken("otro")).toBeNull()
  })
})

describe("procesarIngesta", () => {
  it("crea solo los hallazgos nuevos y bloquea por severidad", async () => {
    prismaMock.hallazgo.findMany.mockResolvedValue([{ id: 1, huella: H("a"), estado: "ABIERTO" }])
    const r = await procesarIngesta(repo, payload({ hallazgos: [hallazgo(H("a")), hallazgo(H("b"), "Baja")] }), null)
    const creados = prismaMock.hallazgo.createMany.mock.calls[0][0].data
    expect(creados.map((h: { huella: string }) => h.huella)).toEqual([H("b")])
    expect(r).toMatchObject({ escaneoId: 10, resultado: "BLOQUEADO", hallazgosNuevos: 1, hallazgosExistentes: 1 })
    expect(r.url).toBe("http://guard.test/escaneos/10")
  })

  it("registra en deteccion todos los hallazgos presentes, nuevos y existentes", async () => {
    prismaMock.hallazgo.findMany
      .mockResolvedValueOnce([{ id: 1, huella: H("a"), estado: "ABIERTO" }])
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
    await procesarIngesta(repo, payload({ hallazgos: [hallazgo(H("a")), hallazgo(H("b"), "Baja")] }), null)
    expect(prismaMock.deteccion.deleteMany).toHaveBeenCalledWith({ where: { escaneoId: 10, hallazgoId: { notIn: [1, 2] } } })
    expect(prismaMock.deteccion.createMany).toHaveBeenCalledWith({
      data: [{ escaneoId: 10, hallazgoId: 1 }, { escaneoId: 10, hallazgoId: 2 }],
      skipDuplicates: true,
    })
  })

  it("un análisis sin hallazgos deja el escaneo sin detecciones", async () => {
    await procesarIngesta(repo, payload(), null)
    expect(prismaMock.deteccion.deleteMany).toHaveBeenCalledWith({ where: { escaneoId: 10, hallazgoId: { notIn: [] } } })
    expect(prismaMock.deteccion.createMany).not.toHaveBeenCalled()
  })

  it("un falso positivo no bloquea aunque reaparezca", async () => {
    prismaMock.hallazgo.findMany.mockResolvedValue([{ id: 1, huella: H("a"), estado: "FALSO_POSITIVO" }])
    const r = await procesarIngesta(repo, payload({ hallazgos: [hallazgo(H("a"), "Crítica")] }), null)
    expect(r.resultado).toBe("APROBADO")
  })

  it("reabre un hallazgo resuelto que vuelve a aparecer", async () => {
    prismaMock.hallazgo.findMany.mockResolvedValue([{ id: 7, huella: H("a"), estado: "RESUELTO" }])
    await procesarIngesta(repo, payload({ hallazgos: [hallazgo(H("a"), "Baja")] }), null)
    expect(prismaMock.hallazgo.updateMany).toHaveBeenCalledWith({ where: { id: { in: [7] } }, data: { estado: "ABIERTO", fechaCierre: null } })
  })

  it("en un pull request nunca da por resuelto lo que no aparece", async () => {
    await procesarIngesta(repo, payload(), null)
    expect(prismaMock.hallazgo.updateMany).not.toHaveBeenCalled()
  })

  it("en la rama principal resuelve lo ausente, solo de las herramientas que corrieron", async () => {
    prismaMock.hallazgo.updateMany.mockResolvedValue({ count: 3 })
    const r = await procesarIngesta(repo, payload({ numeroPr: null, ramaOrigen: "main", hallazgos: [hallazgo(H("a"), "Baja")] }), null)
    const llamada = prismaMock.hallazgo.updateMany.mock.calls.at(-1)![0]
    expect(llamada.where.herramientaId).toEqual({ in: [3] })
    expect(llamada.where.huella).toEqual({ notIn: [H("a")] })
    expect(r.hallazgosResueltos).toBe(3)
  })

  it("si ninguna herramienta corrió, no resuelve nada", async () => {
    await procesarIngesta(repo, payload({ numeroPr: null, ramaOrigen: "main", herramientasEjecutadas: [] }), null)
    expect(prismaMock.hallazgo.updateMany).not.toHaveBeenCalled()
  })

  it("sin reporte de pruebas el análisis queda en ERROR, no aprobado", async () => {
    const r = await procesarIngesta(repo, payload({ herramientasEjecutadas: ["Semgrep"] }), null)
    expect(r.resultado).toBe("ERROR")
    expect(r.motivos).toEqual([MOTIVO_SIN_PRUEBAS])
    expect(prismaMock.escaneo.update.mock.calls.at(-1)![0].data).toMatchObject({ resultadoAnalisis: "ERROR", resultado: "ERROR" })
  })

  it("el checklist pendiente bloquea si la política lo exige", async () => {
    prismaMock.repositorioPolitica.findMany.mockResolvedValue([{
      politica: { nombre: "IA", coberturaMinima: null, exigeChecklistIa: true, severidadBloqueo: { nivel: 4, nombre: "Crítica" } },
    }])
    const r = await procesarIngesta(repo, payload(), null)
    expect(r.resultado).toBe("BLOQUEADO")
    expect(r.motivos.at(-1)).toMatch(/checklist/)
    prismaMock.respuestaChecklist.count.mockResolvedValue(6)
    expect((await procesarIngesta(repo, payload(), null)).resultado).toBe("APROBADO")
  })
})
