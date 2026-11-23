"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { ipDesdeHeaders } from "@/lib/audit"
import { restablecerPassword } from "@/lib/auth/recuperacion"

export type EstadoRestablecer = { error?: string }

export async function guardarNuevaPassword(_prev: EstadoRestablecer, formData: FormData): Promise<EstadoRestablecer> {
  const r = await restablecerPassword(
    String(formData.get("token") ?? ""),
    String(formData.get("password") ?? ""),
    String(formData.get("confirmacion") ?? ""),
    ipDesdeHeaders(await headers()),
  )
  if (!r.ok) return { error: r.error }
  redirect("/login?aviso=restablecida")
}
