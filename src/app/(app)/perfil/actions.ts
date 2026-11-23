"use server"

import { revalidatePath } from "next/cache"
import { signOut } from "@/lib/auth/config"
import { ctxUsuario } from "@/lib/acciones"
import { aEstado, type EstadoForm } from "@/lib/resultado"
import { campos } from "@/lib/validacion"
import { actualizarPerfil, cambiarPassword } from "@/lib/usuarios"

export async function actualizarPerfilAction(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const ctx = await ctxUsuario()
  const r = await actualizarPerfil(ctx, campos(formData, ["nombre", "apellido", "usuarioGithub"]))
  if (r.ok) revalidatePath("/", "layout")
  return aEstado(r, "Perfil actualizado.")
}

export async function cambiarPasswordAction(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const ctx = await ctxUsuario()
  const f = campos(formData, ["actual", "nueva", "confirmacion"])
  const r = await cambiarPassword(ctx, f.actual, f.nueva, f.confirmacion)
  if (!r.ok) return { error: r.error }
  // Cambiar la clave invalida todas las sesiones, incluida esta.
  await signOut({ redirectTo: "/login?aviso=restablecida" })
  return {}
}
