import { randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"

export const PASSWORD_MIN = 12
// bcrypt ignora lo que pasa de 72 bytes: se rechaza para que dos claves distintas no valgan lo mismo.
export const PASSWORD_MAX_BYTES = 72
const COSTO = 12

export function validarPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) return "La contraseña es demasiado larga."
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password) || !/\d/.test(password)) {
    return "La contraseña debe combinar letras y números."
  }
  return null
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COSTO)
}

export function verificarPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

let señuelo: Promise<string> | null = null

// Hash de una clave que nadie conoce: se compara contra él cuando el correo no existe,
// para que la respuesta tarde lo mismo y no revele qué cuentas hay.
export function hashSeñuelo(): Promise<string> {
  señuelo ??= bcrypt.hash(randomBytes(24).toString("hex"), COSTO)
  return señuelo
}
