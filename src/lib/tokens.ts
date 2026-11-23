import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

/** Token aleatorio para mostrar una sola vez; en la base solo se guarda su SHA-256. */
export function generarToken(prefijo = ""): string {
  return prefijo + randomBytes(32).toString("base64url")
}

export function sha256Hex(valor: string): string {
  return createHash("sha256").update(valor).digest("hex")
}

/** Comparación en tiempo constante, aunque los textos tengan distinto largo. */
export function igualSeguro(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest()
  const hb = createHash("sha256").update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function extraerBearer(header: string | null): string | null {
  if (!header) return null
  const m = header.match(/^Bearer\s+(\S+)$/i)
  return m ? m[1] : null
}
