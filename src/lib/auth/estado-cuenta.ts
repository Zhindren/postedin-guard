import { prisma } from "@/lib/db"
import { esRolValido, type RolNombre } from "@/lib/roles"

export type EstadoCuentaActual = { activo: boolean; versionSesion: number; rol: RolNombre; nombre: string }

const CACHE_MS = 15_000
const cache = new Map<number, { valor: EstadoCuentaActual | null; en: number }>()

/**
 * Estado vigente de la cuenta para validar cada request. La caché corta evita una consulta
 * por request; una desactivación o cambio de contraseña se nota a más tardar en 15 s, o al
 * instante en esta instancia gracias a olvidarEstadoCuenta.
 */
export async function estadoCuenta(id: number, ahora = Date.now()): Promise<EstadoCuentaActual | null> {
  const hit = cache.get(id)
  if (hit && ahora - hit.en < CACHE_MS) return hit.valor
  const u = await prisma.usuario.findUnique({
    where: { id },
    select: { activo: true, versionSesion: true, nombre: true, apellido: true, rol: { select: { nombre: true } } },
  })
  const valor = u && esRolValido(u.rol.nombre)
    ? { activo: u.activo, versionSesion: u.versionSesion, rol: u.rol.nombre, nombre: `${u.nombre} ${u.apellido}` }
    : null
  cache.set(id, { valor, en: ahora })
  return valor
}

export function olvidarEstadoCuenta(id: number): void {
  cache.delete(id)
}
