import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/db"
import { registrarEvento } from "@/lib/audit"
import { cuentaDemoProtegida, dominiosPermitidos, MENSAJE_CUENTA_DEMO } from "@/lib/env"
import { ROLES } from "@/lib/roles"
import { exito, fallo, primerError, type Resultado } from "@/lib/resultado"
import { esquemaPerfil, esquemaUsuario, esquemaUsuarioEdicion } from "@/lib/validacion"
import type { SesionGuard } from "@/lib/auth/guards"
import { correoPermitido } from "@/lib/auth/reglas"
import { hashPassword, validarPassword, verificarPassword } from "@/lib/auth/password"
import { olvidarEstadoCuenta } from "@/lib/auth/estado-cuenta"
import { enviarInvitacion } from "@/lib/auth/recuperacion"

type Ctx = { actor: SesionGuard; ip: string | null }

function esErrorUnico(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002"
}

async function idRol(nombre: string): Promise<number> {
  const rol = await prisma.rol.findUniqueOrThrow({ where: { nombre } })
  return rol.id
}

async function quedaOtroLiderActivo(excluirId: number): Promise<boolean> {
  const n = await prisma.usuario.count({ where: { id: { not: excluirId }, activo: true, rol: { nombre: ROLES.LIDER } } })
  return n > 0
}

/** `enlace` solo viene cuando el correo no salió: el Líder lo entrega a mano, una vez. */
export type CuentaCreada = { id: number; enlace: string | null }

export async function crearUsuario(ctx: Ctx, datos: unknown): Promise<Resultado<CuentaCreada>> {
  const p = esquemaUsuario.safeParse(datos)
  if (!p.success) return fallo(primerError(p.error.issues))
  if (!correoPermitido(p.data.email, dominiosPermitidos())) {
    return fallo(`Solo se permiten correos de: ${dominiosPermitidos().join(", ")}.`)
  }
  try {
    const u = await prisma.usuario.create({
      data: {
        nombre: p.data.nombre,
        apellido: p.data.apellido,
        email: p.data.email,
        usuarioGithub: p.data.usuarioGithub,
        rolId: await idRol(p.data.rol),
        // Clave aleatoria que nadie conoce: la persona define la suya con la invitación.
        passwordHash: await hashPassword(randomBytes(24).toString("hex")),
      },
    })
    const inv = await enviarInvitacion(u)
    await registrarEvento({ usuarioId: ctx.actor.id, accion: "USUARIO_CREADO", entidad: "usuario", entidadId: u.id, detalle: p.data.rol, ip: ctx.ip })
    return exito({ id: u.id, enlace: inv.enviado ? null : inv.enlace })
  } catch (e) {
    if (esErrorUnico(e)) return fallo("Ya existe una cuenta con ese correo o usuario de GitHub.")
    throw e
  }
}

export async function editarUsuario(ctx: Ctx, id: number, datos: unknown): Promise<Resultado> {
  const p = esquemaUsuarioEdicion.safeParse(datos)
  if (!p.success) return fallo(primerError(p.error.issues))
  const actual = await prisma.usuario.findUnique({ where: { id }, include: { rol: true } })
  if (!actual) return fallo("La cuenta no existe.")
  if (cuentaDemoProtegida(actual.email)) return fallo(MENSAJE_CUENTA_DEMO)
  const pierdeLider = actual.rol.nombre === ROLES.LIDER && p.data.rol !== ROLES.LIDER
  if (pierdeLider && actual.activo && !(await quedaOtroLiderActivo(id))) {
    return fallo("Debe quedar al menos un Líder Técnico activo.")
  }
  try {
    await prisma.usuario.update({
      where: { id },
      data: { nombre: p.data.nombre, apellido: p.data.apellido, usuarioGithub: p.data.usuarioGithub, rolId: await idRol(p.data.rol) },
    })
  } catch (e) {
    if (esErrorUnico(e)) return fallo("Ese usuario de GitHub ya está en uso.")
    throw e
  }
  olvidarEstadoCuenta(id)
  await registrarEvento({ usuarioId: ctx.actor.id, accion: "USUARIO_EDITADO", entidad: "usuario", entidadId: id, detalle: p.data.rol, ip: ctx.ip })
  return exito(undefined)
}

export async function cambiarEstadoUsuario(ctx: Ctx, id: number, activo: boolean): Promise<Resultado> {
  if (id === ctx.actor.id && !activo) return fallo("No puedes desactivar tu propia cuenta.")
  const actual = await prisma.usuario.findUnique({ where: { id }, include: { rol: true } })
  if (!actual) return fallo("La cuenta no existe.")
  if (cuentaDemoProtegida(actual.email)) return fallo(MENSAJE_CUENTA_DEMO)
  if (!activo && actual.rol.nombre === ROLES.LIDER && !(await quedaOtroLiderActivo(id))) {
    return fallo("Debe quedar al menos un Líder Técnico activo.")
  }
  // Desactivar sube la versión de sesión: la persona queda fuera de inmediato.
  await prisma.usuario.update({
    where: { id },
    data: activo ? { activo: true } : { activo: false, versionSesion: { increment: 1 }, resetHash: null, resetExpira: null },
  })
  olvidarEstadoCuenta(id)
  await registrarEvento({
    usuarioId: ctx.actor.id, accion: activo ? "USUARIO_ACTIVADO" : "USUARIO_DESACTIVADO", entidad: "usuario", entidadId: id, ip: ctx.ip,
  })
  return exito(undefined)
}

export async function reenviarInvitacion(ctx: Ctx, id: number): Promise<Resultado<{ enlace: string | null }>> {
  const u = await prisma.usuario.findUnique({ where: { id } })
  if (!u || !u.activo) return fallo("La cuenta no existe o está desactivada.")
  if (cuentaDemoProtegida(u.email)) return fallo(MENSAJE_CUENTA_DEMO)
  const inv = await enviarInvitacion(u)
  await registrarEvento({ usuarioId: ctx.actor.id, accion: "INVITACION_REENVIADA", entidad: "usuario", entidadId: id, ip: ctx.ip })
  return exito({ enlace: inv.enviado ? null : inv.enlace })
}

export async function actualizarPerfil(ctx: Ctx, datos: unknown): Promise<Resultado> {
  const p = esquemaPerfil.safeParse(datos)
  if (!p.success) return fallo(primerError(p.error.issues))
  try {
    await prisma.usuario.update({ where: { id: ctx.actor.id }, data: p.data })
  } catch (e) {
    if (esErrorUnico(e)) return fallo("Ese usuario de GitHub ya está en uso.")
    throw e
  }
  olvidarEstadoCuenta(ctx.actor.id)
  await registrarEvento({ usuarioId: ctx.actor.id, accion: "PERFIL_ACTUALIZADO", entidad: "usuario", entidadId: ctx.actor.id, ip: ctx.ip })
  return exito(undefined)
}

export async function cambiarPassword(ctx: Ctx, actual: string, nueva: string, confirmacion: string): Promise<Resultado> {
  if (nueva !== confirmacion) return fallo("Las contraseñas nuevas no coinciden.")
  const invalida = validarPassword(nueva)
  if (invalida) return fallo(invalida)
  const u = await prisma.usuario.findUnique({ where: { id: ctx.actor.id } })
  if (!u || !(await verificarPassword(actual, u.passwordHash))) {
    await registrarEvento({ usuarioId: ctx.actor.id, accion: "PASSWORD_CAMBIO_FALLIDO", entidad: "usuario", entidadId: ctx.actor.id, ip: ctx.ip })
    return fallo("La contraseña actual no es correcta.")
  }
  if (cuentaDemoProtegida(u.email)) return fallo(MENSAJE_CUENTA_DEMO)
  if (await verificarPassword(nueva, u.passwordHash)) return fallo("La nueva contraseña debe ser distinta de la actual.")
  await prisma.usuario.update({
    where: { id: u.id },
    data: { passwordHash: await hashPassword(nueva), versionSesion: { increment: 1 } },
  })
  olvidarEstadoCuenta(u.id)
  await registrarEvento({ usuarioId: u.id, accion: "PASSWORD_CAMBIADA", entidad: "usuario", entidadId: u.id, ip: ctx.ip })
  return exito(undefined)
}
