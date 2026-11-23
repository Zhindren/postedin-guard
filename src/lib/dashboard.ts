import { prisma } from "@/lib/db"
import { esLider, type SesionGuard } from "@/lib/auth/guards"
import type { Prisma } from "@/generated/prisma/client"

const DIA_MS = 86_400_000
export const SEMANAS = 6
const PENDIENTE: Prisma.HallazgoWhereInput = { estado: { in: ["ABIERTO", "EN_PROGRESO"] } }

/** Lunes 00:00 UTC de la semana de la fecha. */
export function inicioSemana(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dia = (x.getUTCDay() + 6) % 7
  return new Date(x.getTime() - dia * DIA_MS)
}

export type FilaSemana = { semana: Date; nivel: number; n: number }
export type ColumnaSemana = { etiqueta: string; porNivel: Record<number, number>; total: number }

/** Completa con ceros las semanas sin hallazgos para que el gráfico siempre tenga 6 columnas. */
export function columnasPorSemana(filas: FilaSemana[], ahora: Date, semanas = SEMANAS): ColumnaSemana[] {
  const actual = inicioSemana(ahora).getTime()
  const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  return Array.from({ length: semanas }, (_, i) => {
    const inicio = actual - (semanas - 1 - i) * 7 * DIA_MS
    const porNivel: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
    for (const f of filas) if (inicioSemana(f.semana).getTime() === inicio) porNivel[f.nivel] = (porNivel[f.nivel] ?? 0) + f.n
    return { etiqueta: fmt(new Date(inicio)), porNivel, total: Object.values(porNivel).reduce((a, b) => a + b, 0) }
  })
}

export function porcentaje(parte: number, total: number): number | null {
  return total === 0 ? null : Math.round((parte / total) * 1000) / 10
}

export function promedioDias(pares: { desde: Date; hasta: Date }[]): number | null {
  if (pares.length === 0) return null
  const total = pares.reduce((s, p) => s + (p.hasta.getTime() - p.desde.getTime()), 0)
  return Math.round((total / pares.length / DIA_MS) * 10) / 10
}

/** Indicadores del dashboard. El Desarrollador ve los suyos; el Líder, los de todo el equipo. */
export async function indicadores(actor: SesionGuard, ahora = new Date()) {
  const propio: Prisma.HallazgoWhereInput = esLider(actor) ? {} : { asignadoId: actor.id }
  const hace30 = new Date(ahora.getTime() - 30 * DIA_MS)
  const desdeSemanas = new Date(inicioSemana(ahora).getTime() - (SEMANAS - 1) * 7 * DIA_MS)

  const [criticos, altos, pendientesPropios, escaneosPr, aprobadosPr, cerrados, coberturas, porCategoria, porSemana, ultimos] = await Promise.all([
    prisma.hallazgo.count({ where: { ...PENDIENTE, ...propio, severidad: { nivel: 4 } } }),
    prisma.hallazgo.count({ where: { ...PENDIENTE, ...propio, severidad: { nivel: 3 } } }),
    prisma.hallazgo.findMany({
      where: { ...PENDIENTE, ...propio },
      select: { fechaDeteccion: true, severidad: { select: { plazoDias: true } } },
    }),
    prisma.escaneo.count({ where: { numeroPr: { not: null }, fechaEjecucion: { gte: hace30 } } }),
    prisma.escaneo.count({ where: { numeroPr: { not: null }, fechaEjecucion: { gte: hace30 }, resultado: "APROBADO" } }),
    prisma.hallazgo.findMany({
      where: { ...propio, estado: "RESUELTO", fechaCierre: { gte: hace30 } },
      select: { fechaDeteccion: true, fechaCierre: true },
    }),
    prisma.escaneo.findMany({
      where: { coberturaPruebas: { not: null } },
      orderBy: { fechaEjecucion: "desc" },
      distinct: ["repositorioId"],
      select: { coberturaPruebas: true },
    }),
    prisma.hallazgo.groupBy({ by: ["categoriaId"], where: { ...PENDIENTE, ...propio }, _count: { _all: true } }),
    prisma.$queryRaw<{ semana: Date; nivel: number; n: bigint }[]>`
      SELECT date_trunc('week', h.fecha_deteccion) AS semana, s.nivel, count(*) AS n
      FROM hallazgo h JOIN severidad s ON s.id_severidad = h.id_severidad
      WHERE h.fecha_deteccion >= ${desdeSemanas}
        AND (${esLider(actor)} OR h.id_asignado = ${actor.id})
      GROUP BY 1, 2`,
    prisma.escaneo.findMany({
      orderBy: { fechaEjecucion: "desc" },
      take: 5,
      include: { repositorio: { select: { nombre: true } } },
    }),
  ])
  const categorias = await prisma.categoriaHallazgo.findMany({ where: { id: { in: porCategoria.map((c) => c.categoriaId) } } })
  const nombreCat = new Map(categorias.map((c) => [c.id, c.nombre]))
  const vencidos = pendientesPropios.filter((h) => ahora.getTime() > h.fechaDeteccion.getTime() + h.severidad.plazoDias * DIA_MS).length
  const valoresCobertura = coberturas.map((c) => Number(c.coberturaPruebas))

  return {
    criticos,
    altos,
    pendientes: pendientesPropios.length,
    vencidos,
    aprobacionPr: porcentaje(aprobadosPr, escaneosPr),
    escaneosPr,
    remediacionDias: promedioDias(cerrados.map((c) => ({ desde: c.fechaDeteccion, hasta: c.fechaCierre! }))),
    cobertura: valoresCobertura.length ? Math.round((valoresCobertura.reduce((a, b) => a + b, 0) / valoresCobertura.length) * 10) / 10 : null,
    porCategoria: porCategoria
      .map((c) => ({ nombre: nombreCat.get(c.categoriaId) ?? "Otra", n: c._count._all }))
      .sort((a, b) => b.n - a.n),
    semanas: columnasPorSemana(porSemana.map((f) => ({ semana: new Date(f.semana), nivel: Number(f.nivel), n: Number(f.n) })), ahora),
    ultimos,
  }
}
