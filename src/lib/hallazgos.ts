import { z } from "zod"
import { prisma } from "@/lib/db"
import { registrarEvento } from "@/lib/audit"
import { exito, fallo, primerError, type Resultado } from "@/lib/resultado"
import { esLider, type SesionGuard } from "@/lib/auth/guards"
import type { EstadoHallazgo, Prisma } from "@/generated/prisma/client"

type Ctx = { actor: SesionGuard; ip: string | null }

export const ESTADOS: EstadoHallazgo[] = ["ABIERTO", "EN_PROGRESO", "RESUELTO", "FALSO_POSITIVO"]
export const ETIQUETA_ESTADO: Record<EstadoHallazgo, string> = {
  ABIERTO: "Abierto", EN_PROGRESO: "En progreso", RESUELTO: "Resuelto", FALSO_POSITIVO: "Falso positivo",
}
export const CLASE_ESTADO: Record<EstadoHallazgo, string> = {
  ABIERTO: "abierto", EN_PROGRESO: "progreso", RESUELTO: "resuelto", FALSO_POSITIVO: "fp",
}
export const POR_PAGINA = 25
const DIA_MS = 86_400_000

export type Filtros = {
  repo: number | null
  severidad: number | null
  estado: EstadoHallazgo | "PENDIENTES" | null
  responsable: "yo" | "sin" | number | null
  q: string
  pagina: number
}

const entero = (v: unknown) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 && n < 2_147_483_647 ? n : null
}

/** Lee los filtros de la URL sin confiar en ellos: lo que no es válido se ignora. */
export function leerFiltros(sp: Record<string, string | string[] | undefined>): Filtros {
  const uno = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? ""
  const estado = uno("estado")
  const responsable = uno("responsable")
  return {
    repo: entero(uno("repo")),
    severidad: entero(uno("severidad")),
    estado: estado === "PENDIENTES" || (ESTADOS as string[]).includes(estado) ? (estado as Filtros["estado"]) : null,
    responsable: responsable === "yo" || responsable === "sin" ? responsable : entero(responsable),
    q: uno("q").trim().slice(0, 100),
    pagina: entero(uno("pagina")) ?? 1,
  }
}

export function whereHallazgos(f: Filtros, actor: SesionGuard): Prisma.HallazgoWhereInput {
  const and: Prisma.HallazgoWhereInput[] = []
  if (f.repo) and.push({ escaneo: { repositorioId: f.repo } })
  if (f.severidad) and.push({ severidadId: f.severidad })
  if (f.estado === "PENDIENTES") and.push({ estado: { in: ["ABIERTO", "EN_PROGRESO"] } })
  else if (f.estado) and.push({ estado: f.estado })
  if (f.responsable === "yo") and.push({ asignadoId: actor.id })
  else if (f.responsable === "sin") and.push({ asignadoId: null })
  else if (typeof f.responsable === "number") and.push({ asignadoId: f.responsable })
  if (f.q) {
    and.push({
      OR: [
        { titulo: { contains: f.q, mode: "insensitive" } },
        { rutaArchivo: { contains: f.q, mode: "insensitive" } },
        { regla: { contains: f.q, mode: "insensitive" } },
      ],
    })
  }
  return and.length ? { AND: and } : {}
}

export function fechaLimite(fechaDeteccion: Date, plazoDias: number): Date {
  return new Date(fechaDeteccion.getTime() + plazoDias * DIA_MS)
}

export function estaVencido(h: { estado: EstadoHallazgo; fechaDeteccion: Date }, plazoDias: number, ahora = new Date()): boolean {
  return (h.estado === "ABIERTO" || h.estado === "EN_PROGRESO") && ahora > fechaLimite(h.fechaDeteccion, plazoDias)
}

export async function listarHallazgos(f: Filtros, actor: SesionGuard) {
  const where = whereHallazgos(f, actor)
  const [total, filas] = await Promise.all([
    prisma.hallazgo.count({ where }),
    prisma.hallazgo.findMany({
      where,
      orderBy: [{ severidad: { nivel: "desc" } }, { fechaDeteccion: "desc" }],
      skip: (f.pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        severidad: true,
        categoria: { select: { nombre: true } },
        herramienta: { select: { nombre: true } },
        asignado: { select: { nombre: true, apellido: true } },
        escaneo: { select: { numeroPr: true, repositorio: { select: { nombre: true } } } },
      },
    }),
  ])
  return { total, filas, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)) }
}

/** El Líder modifica cualquier hallazgo; el Desarrollador solo los que tiene asignados. */
export function puedeGestionar(actor: SesionGuard, h: { asignadoId: number | null }): boolean {
  return esLider(actor) || h.asignadoId === actor.id
}

const esquemaEstado = z
  .object({
    estado: z.enum(["ABIERTO", "EN_PROGRESO", "RESUELTO", "FALSO_POSITIVO"], { message: "Elige un estado válido." }),
    justificacion: z.string().trim().max(1000, "La justificación admite hasta 1000 caracteres."),
  })
  .refine((v) => v.estado !== "FALSO_POSITIVO" || v.justificacion.length >= 10, {
    message: "Para marcar un falso positivo, explica en al menos 10 caracteres por qué no aplica.",
  })

export async function cambiarEstado(ctx: Ctx, id: number, datos: unknown, ahora = new Date()): Promise<Resultado> {
  const p = esquemaEstado.safeParse(datos)
  if (!p.success) return fallo(primerError(p.error.issues))
  const h = await prisma.hallazgo.findUnique({ where: { id }, select: { id: true, estado: true, asignadoId: true } })
  if (!h) return fallo("El hallazgo no existe.")
  if (!puedeGestionar(ctx.actor, h)) return fallo("Solo puedes modificar hallazgos asignados a ti.")
  if (h.estado === p.data.estado) return fallo("El hallazgo ya está en ese estado.")
  const cerrado = p.data.estado === "RESUELTO" || p.data.estado === "FALSO_POSITIVO"
  await prisma.$transaction(async (tx) => {
    await tx.hallazgo.update({ where: { id }, data: { estado: p.data.estado, fechaCierre: cerrado ? ahora : null } })
    if (p.data.justificacion) {
      const prefijo = p.data.estado === "FALSO_POSITIVO" ? "Falso positivo: " : `${ETIQUETA_ESTADO[p.data.estado]}: `
      await tx.comentarioHallazgo.create({ data: { hallazgoId: id, usuarioId: ctx.actor.id, contenido: prefijo + p.data.justificacion } })
    }
  })
  await registrarEvento({
    usuarioId: ctx.actor.id, accion: "HALLAZGO_ESTADO", entidad: "hallazgo", entidadId: id, detalle: `${h.estado} → ${p.data.estado}`, ip: ctx.ip,
  })
  return exito(undefined)
}

/** `avisar` indica si hay que mandar el correo de asignación: responsable nuevo y distinto de quien asigna. */
export async function asignar(ctx: Ctx, id: number, usuarioId: number | null): Promise<Resultado<{ avisar: boolean }>> {
  if (!esLider(ctx.actor)) return fallo("Solo el Líder Técnico asigna responsables.")
  if (usuarioId !== null) {
    const u = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { activo: true } })
    if (!u?.activo) return fallo("El responsable debe ser una cuenta activa.")
  }
  const h = await prisma.hallazgo.findUnique({ where: { id }, select: { id: true, asignadoId: true } })
  if (!h) return fallo("El hallazgo no existe.")
  await prisma.hallazgo.update({ where: { id }, data: { asignadoId: usuarioId } })
  await registrarEvento({
    usuarioId: ctx.actor.id, accion: "HALLAZGO_ASIGNADO", entidad: "hallazgo", entidadId: id, detalle: usuarioId ? `usuario ${usuarioId}` : "sin responsable", ip: ctx.ip,
  })
  return exito({ avisar: usuarioId !== null && usuarioId !== h.asignadoId && usuarioId !== ctx.actor.id })
}

const esquemaComentario = z.string().trim().min(1, "Escribe un comentario.").max(2000, "El comentario admite hasta 2000 caracteres.")

export async function comentar(ctx: Ctx, id: number, texto: unknown): Promise<Resultado> {
  const p = esquemaComentario.safeParse(texto)
  if (!p.success) return fallo(primerError(p.error.issues))
  const h = await prisma.hallazgo.findUnique({ where: { id }, select: { id: true } })
  if (!h) return fallo("El hallazgo no existe.")
  await prisma.comentarioHallazgo.create({ data: { hallazgoId: id, usuarioId: ctx.actor.id, contenido: p.data } })
  await registrarEvento({ usuarioId: ctx.actor.id, accion: "HALLAZGO_COMENTADO", entidad: "hallazgo", entidadId: id, ip: ctx.ip })
  return exito(undefined)
}
