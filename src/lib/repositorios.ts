import { prisma } from "@/lib/db"
import { registrarEvento } from "@/lib/audit"
import { exito, fallo, primerError, type Resultado } from "@/lib/resultado"
import { esquemaRepositorio } from "@/lib/validacion"
import { generarToken, sha256Hex } from "@/lib/tokens"
import type { SesionGuard } from "@/lib/auth/guards"

type Ctx = { actor: SesionGuard; ip: string | null }

export const PREFIJO_TOKEN = "pgr_"

async function responsableValido(id: number): Promise<boolean> {
  const u = await prisma.usuario.findUnique({ where: { id }, select: { activo: true } })
  return !!u?.activo
}

export async function crearRepositorio(ctx: Ctx, datos: unknown): Promise<Resultado<number>> {
  const p = esquemaRepositorio.safeParse(datos)
  if (!p.success) return fallo(primerError(p.error.issues))
  if (!(await responsableValido(p.data.responsableId))) return fallo("El responsable debe ser una cuenta activa.")
  const existe = await prisma.repositorio.findUnique({ where: { urlGithub: p.data.urlGithub } })
  if (existe) return fallo("Ese repositorio ya está registrado.")
  const r = await prisma.repositorio.create({ data: p.data })
  await registrarEvento({ usuarioId: ctx.actor.id, accion: "REPOSITORIO_CREADO", entidad: "repositorio", entidadId: r.id, detalle: r.urlGithub, ip: ctx.ip })
  return exito(r.id)
}

export async function editarRepositorio(ctx: Ctx, id: number, datos: unknown): Promise<Resultado> {
  const p = esquemaRepositorio.safeParse(datos)
  if (!p.success) return fallo(primerError(p.error.issues))
  if (!(await responsableValido(p.data.responsableId))) return fallo("El responsable debe ser una cuenta activa.")
  const otro = await prisma.repositorio.findUnique({ where: { urlGithub: p.data.urlGithub } })
  if (otro && otro.id !== id) return fallo("Ese repositorio ya está registrado.")
  await prisma.repositorio.update({ where: { id }, data: p.data })
  await registrarEvento({ usuarioId: ctx.actor.id, accion: "REPOSITORIO_EDITADO", entidad: "repositorio", entidadId: id, ip: ctx.ip })
  return exito(undefined)
}

export async function cambiarEstadoRepositorio(ctx: Ctx, id: number, activo: boolean): Promise<Resultado> {
  // Un repositorio desactivado deja de aceptar análisis: su token se revoca.
  await prisma.repositorio.update({ where: { id }, data: activo ? { activo } : { activo, tokenHash: null } })
  await registrarEvento({
    usuarioId: ctx.actor.id, accion: activo ? "REPOSITORIO_ACTIVADO" : "REPOSITORIO_DESACTIVADO", entidad: "repositorio", entidadId: id, ip: ctx.ip,
  })
  return exito(undefined)
}

/** Devuelve el token en claro una sola vez; en la base queda solo su SHA-256. */
export async function emitirToken(ctx: Ctx, id: number): Promise<Resultado<string>> {
  const repo = await prisma.repositorio.findUnique({ where: { id } })
  if (!repo) return fallo("El repositorio no existe.")
  if (!repo.activo) return fallo("Activa el repositorio antes de generar un token.")
  const token = generarToken(PREFIJO_TOKEN)
  await prisma.repositorio.update({ where: { id }, data: { tokenHash: sha256Hex(token) } })
  await registrarEvento({
    usuarioId: ctx.actor.id, accion: repo.tokenHash ? "TOKEN_REGENERADO" : "TOKEN_GENERADO", entidad: "repositorio", entidadId: id, ip: ctx.ip,
  })
  return exito(token)
}

export async function revocarToken(ctx: Ctx, id: number): Promise<Resultado> {
  await prisma.repositorio.update({ where: { id }, data: { tokenHash: null } })
  await registrarEvento({ usuarioId: ctx.actor.id, accion: "TOKEN_REVOCADO", entidad: "repositorio", entidadId: id, ip: ctx.ip })
  return exito(undefined)
}
