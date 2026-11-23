import { prisma } from "@/lib/db"
import { registrarEvento } from "@/lib/audit"
import { exito, fallo, primerError, type Resultado } from "@/lib/resultado"
import { esquemaPolitica } from "@/lib/validacion"
import type { SesionGuard } from "@/lib/auth/guards"

type Ctx = { actor: SesionGuard; ip: string | null }

function leer(datos: Record<string, string>) {
  return esquemaPolitica.safeParse({ ...datos, exigeChecklistIa: datos.exigeChecklistIa === "on" })
}

async function nombreLibre(nombre: string, excluirId?: number): Promise<boolean> {
  const otra = await prisma.politicaSeguridad.findUnique({ where: { nombre } })
  return !otra || otra.id === excluirId
}

export async function crearPolitica(ctx: Ctx, datos: Record<string, string>): Promise<Resultado<number>> {
  const p = leer(datos)
  if (!p.success) return fallo(primerError(p.error.issues))
  if (!(await nombreLibre(p.data.nombre))) return fallo("Ya existe una política con ese nombre.")
  const pol = await prisma.politicaSeguridad.create({ data: p.data })
  await registrarEvento({ usuarioId: ctx.actor.id, accion: "POLITICA_CREADA", entidad: "politica", entidadId: pol.id, detalle: pol.nombre, ip: ctx.ip })
  return exito(pol.id)
}

export async function editarPolitica(ctx: Ctx, id: number, datos: Record<string, string>): Promise<Resultado> {
  const p = leer(datos)
  if (!p.success) return fallo(primerError(p.error.issues))
  if (!(await nombreLibre(p.data.nombre, id))) return fallo("Ya existe una política con ese nombre.")
  await prisma.politicaSeguridad.update({ where: { id }, data: p.data })
  await registrarEvento({ usuarioId: ctx.actor.id, accion: "POLITICA_EDITADA", entidad: "politica", entidadId: id, ip: ctx.ip })
  return exito(undefined)
}

export async function cambiarEstadoPolitica(ctx: Ctx, id: number, activa: boolean): Promise<Resultado> {
  await prisma.politicaSeguridad.update({ where: { id }, data: { activa } })
  await registrarEvento({ usuarioId: ctx.actor.id, accion: activa ? "POLITICA_ACTIVADA" : "POLITICA_DESACTIVADA", entidad: "politica", entidadId: id, ip: ctx.ip })
  return exito(undefined)
}

/** Reemplaza las políticas asignadas a un repositorio. */
export async function asignarPoliticas(ctx: Ctx, repositorioId: number, politicaIds: number[]): Promise<Resultado> {
  const ids = [...new Set(politicaIds)]
  const existentes = await prisma.politicaSeguridad.count({ where: { id: { in: ids } } })
  if (existentes !== ids.length) return fallo("Alguna política no existe.")
  await prisma.$transaction([
    prisma.repositorioPolitica.deleteMany({ where: { repositorioId, politicaId: { notIn: ids } } }),
    ...ids.map((politicaId) =>
      prisma.repositorioPolitica.upsert({
        where: { repositorioId_politicaId: { repositorioId, politicaId } },
        update: {},
        create: { repositorioId, politicaId },
      }),
    ),
  ])
  await registrarEvento({
    usuarioId: ctx.actor.id, accion: "POLITICAS_ASIGNADAS", entidad: "repositorio", entidadId: repositorioId, detalle: ids.join(",") || "ninguna", ip: ctx.ip,
  })
  return exito(undefined)
}
