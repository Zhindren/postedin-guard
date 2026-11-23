import { z } from "zod"
import { prisma } from "@/lib/db"
import { registrarEvento } from "@/lib/audit"
import { enviarCorreo } from "@/lib/mail"
import { urlPublica } from "@/lib/env"
import { generarToken, sha256Hex } from "@/lib/tokens"
import { hashPassword, validarPassword } from "./password"
import { olvidarEstadoCuenta } from "./estado-cuenta"

export const VIGENCIA_ENLACE_MS = 30 * 60 * 1000

const correo = z.string().trim().toLowerCase().email().max(120)

/**
 * Siempre responde igual, exista o no la cuenta, para no revelar qué correos están registrados.
 */
export async function solicitarRecuperacion(email: unknown, ip: string | null, ahora = new Date()): Promise<void> {
  const parsed = correo.safeParse(email)
  if (!parsed.success) return
  const usuario = await prisma.usuario.findUnique({ where: { email: parsed.data } })
  if (!usuario || !usuario.activo) {
    await registrarEvento({ accion: "RECUPERACION_SOLICITADA", entidad: "usuario", detalle: "correo no registrado o inactivo", ip })
    return
  }
  await enviarEnlaceAcceso(usuario, VIGENCIA_ENLACE_MS, ahora, {
    asunto: "Postedin Guard: restablecer contraseña",
    intro: "Para definir una nueva contraseña entra a este enlace (vale 30 minutos y sirve una sola vez):",
    cierre: "Si no lo pediste, ignora este correo.",
  })
  await registrarEvento({ usuarioId: usuario.id, accion: "RECUPERACION_SOLICITADA", entidad: "usuario", entidadId: usuario.id, ip })
}

export const VIGENCIA_INVITACION_MS = 48 * 60 * 60 * 1000

/** Al crear una cuenta no se fija clave: la persona la define con este enlace (48 h). */
export async function enviarInvitacion(usuario: { id: number; email: string; nombre: string }, ahora = new Date()): Promise<EnlaceAcceso> {
  return enviarEnlaceAcceso(usuario, VIGENCIA_INVITACION_MS, ahora, {
    asunto: "Postedin Guard: activa tu cuenta",
    intro: "Se creó tu cuenta en Postedin Guard. Define tu contraseña en este enlace (vale 48 horas y sirve una sola vez):",
    cierre: "Si no esperabas este correo, avísale a la jefatura técnica.",
  })
}

/** `enviado` es false cuando el correo no está configurado o falló: el enlace no llegó a nadie. */
export type EnlaceAcceso = { enlace: string; enviado: boolean }

async function enviarEnlaceAcceso(
  usuario: { id: number; email: string; nombre: string },
  vigenciaMs: number,
  ahora: Date,
  textos: { asunto: string; intro: string; cierre: string },
): Promise<EnlaceAcceso> {
  const token = generarToken()
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { resetHash: sha256Hex(token), resetExpira: new Date(ahora.getTime() + vigenciaMs) },
  })
  const enlace = `${urlPublica()}/restablecer/${token}`
  const enviado = await enviarCorreo({
    para: usuario.email,
    asunto: textos.asunto,
    texto: `Hola ${usuario.nombre}:\n\n${textos.intro}\n${enlace}\n\n${textos.cierre}`,
  })
  return { enlace, enviado }
}

export type ResultadoRestablecer = { ok: true } | { ok: false; error: string }

export async function enlaceVigente(token: string, ahora = new Date()): Promise<boolean> {
  if (!token || token.length > 100) return false
  const u = await prisma.usuario.findUnique({ where: { resetHash: sha256Hex(token) }, select: { resetExpira: true, activo: true } })
  return !!u && u.activo && !!u.resetExpira && u.resetExpira > ahora
}

export async function restablecerPassword(
  token: string,
  password: string,
  confirmacion: string,
  ip: string | null,
  ahora = new Date(),
): Promise<ResultadoRestablecer> {
  if (password !== confirmacion) return { ok: false, error: "Las contraseñas no coinciden." }
  const invalida = validarPassword(password)
  if (invalida) return { ok: false, error: invalida }
  if (!token || token.length > 100) return { ok: false, error: "El enlace no es válido o ya venció." }

  const usuario = await prisma.usuario.findUnique({ where: { resetHash: sha256Hex(token) } })
  if (!usuario || !usuario.activo || !usuario.resetExpira || usuario.resetExpira <= ahora) {
    return { ok: false, error: "El enlace no es válido o ya venció." }
  }
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      passwordHash: await hashPassword(password),
      resetHash: null,
      resetExpira: null,
      versionSesion: { increment: 1 },
    },
  })
  olvidarEstadoCuenta(usuario.id)
  await registrarEvento({ usuarioId: usuario.id, accion: "PASSWORD_RESTABLECIDA", entidad: "usuario", entidadId: usuario.id, ip })
  return { ok: true }
}
