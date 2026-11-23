export type Resultado<T = undefined> = { ok: true; valor: T } | { ok: false; error: string }

export const exito = <T>(valor: T): Resultado<T> => ({ ok: true, valor })
export const fallo = (error: string): { ok: false; error: string } => ({ ok: false, error })

/** Estado que devuelven las server actions a los formularios. */
export type EstadoForm = { ok?: string; error?: string; token?: string; enlace?: string }

export const MENSAJE_ENLACE_MANUAL =
  "El correo no está configurado, así que no se envió. Copia este enlace y entrégaselo a la persona por un canal privado: vale 48 horas y sirve una sola vez."

export function aEstado<T>(r: Resultado<T>, mensajeOk: string): EstadoForm {
  return r.ok ? { ok: mensajeOk } : { error: r.error }
}

export function primerError(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Datos inválidos."
}
