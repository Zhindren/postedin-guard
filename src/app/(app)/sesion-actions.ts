"use server"

import { headers } from "next/headers"
import { ipDesdeHeaders, registrarEvento } from "@/lib/audit"
import { signOut } from "@/lib/auth/config"
import { requireUser } from "@/lib/auth/guards"

export async function cerrarSesion(): Promise<void> {
  const s = await requireUser()
  await registrarEvento({ usuarioId: s.id, accion: "LOGOUT", entidad: "usuario", entidadId: s.id, ip: ipDesdeHeaders(await headers()) })
  await signOut({ redirectTo: "/login" })
}
