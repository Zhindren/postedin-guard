export const INTENTOS_MAXIMOS = 5
export const VENTANA_BLOQUEO_MS = 15 * 60 * 1000
export const INACTIVIDAD_MAXIMA_MS = 30 * 60 * 1000
export const DURACION_MAXIMA_SESION_MS = 8 * 60 * 60 * 1000

/**
 * Hasta cuándo queda bloqueada una cuenta. Solo cuentan los fallos de los últimos 15
 * minutos posteriores al último acceso exitoso; con 5 o más, el bloqueo dura 15 minutos
 * desde el fallo más reciente.
 */
export function bloqueadaHasta(fallos: Date[], ultimoExito: Date | null, ahora: Date): Date | null {
  const desde = Math.max(ahora.getTime() - VENTANA_BLOQUEO_MS, ultimoExito?.getTime() ?? 0)
  const recientes = fallos.map((f) => f.getTime()).filter((t) => t > desde)
  if (recientes.length < INTENTOS_MAXIMOS) return null
  const hasta = Math.max(...recientes) + VENTANA_BLOQUEO_MS
  return hasta > ahora.getTime() ? new Date(hasta) : null
}

export type DatosSesion = { inicio: number; ultimaActividad: number; version: number }
export type EstadoCuenta = { activo: boolean; versionSesion: number } | null
export type ResultadoSesion = "vigente" | "inactiva" | "expirada" | "revocada"

export function evaluarSesion(sesion: DatosSesion, cuenta: EstadoCuenta, ahora: number): ResultadoSesion {
  if (!cuenta || !cuenta.activo || cuenta.versionSesion !== sesion.version) return "revocada"
  if (ahora - sesion.inicio > DURACION_MAXIMA_SESION_MS) return "expirada"
  if (ahora - sesion.ultimaActividad > INACTIVIDAD_MAXIMA_MS) return "inactiva"
  return "vigente"
}

export function correoPermitido(email: string, dominios: string[]): boolean {
  const at = email.lastIndexOf("@")
  if (at < 1) return false
  const dominio = email.slice(at + 1).toLowerCase()
  return dominios.some((d) => d.toLowerCase() === dominio)
}
