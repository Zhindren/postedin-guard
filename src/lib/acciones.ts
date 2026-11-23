import { headers } from "next/headers"
import { ipDesdeHeaders } from "@/lib/audit"
import { requireLider, requireUser, type SesionGuard } from "@/lib/auth/guards"

export type CtxAccion = { actor: SesionGuard; ip: string | null }

/** Contexto de una server action del Líder Técnico: valida el perfil en el servidor. */
export async function ctxLider(): Promise<CtxAccion> {
  const actor = await requireLider()
  return { actor, ip: ipDesdeHeaders(await headers()) }
}

/** Contexto de una server action de cualquier usuario con sesión. */
export async function ctxUsuario(): Promise<CtxAccion> {
  const actor = await requireUser()
  return { actor, ip: ipDesdeHeaders(await headers()) }
}
