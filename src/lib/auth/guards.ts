import { redirect } from "next/navigation"
import { ROLES, type RolNombre } from "@/lib/roles"
import { auth } from "./config"

export type SesionGuard = { id: number; email: string; nombre: string; rol: RolNombre }

export async function obtenerSesion(): Promise<SesionGuard | null> {
  const s = await auth()
  if (!s?.user?.uid || !s.user.rol) return null
  return { id: s.user.uid, email: s.user.email, nombre: s.user.name, rol: s.user.rol }
}

export function esLider(s: SesionGuard): boolean {
  return s.rol === ROLES.LIDER
}

/** Para páginas y server actions: sin sesión, al login. */
export async function requireUser(): Promise<SesionGuard> {
  const s = await obtenerSesion()
  if (!s) redirect("/login")
  return s
}

/** Para páginas y server actions exclusivas del Líder Técnico. */
export async function requireLider(): Promise<SesionGuard> {
  const s = await requireUser()
  if (!esLider(s)) redirect("/sin-permiso")
  return s
}

type ResultadoApi = { sesion: SesionGuard; respuesta?: undefined } | { sesion?: undefined; respuesta: Response }

/** Para route handlers: responde 401/403 en vez de redirigir. */
export async function apiRequireUser(): Promise<ResultadoApi> {
  const s = await obtenerSesion()
  if (!s) return { respuesta: Response.json({ error: "No autenticado" }, { status: 401 }) }
  return { sesion: s }
}

export async function apiRequireLider(): Promise<ResultadoApi> {
  const r = await apiRequireUser()
  if (r.respuesta) return r
  if (!esLider(r.sesion)) return { respuesta: Response.json({ error: "Sin permiso" }, { status: 403 }) }
  return r
}
