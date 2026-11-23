"use server"

import { revalidatePath } from "next/cache"
import { ctxLider } from "@/lib/acciones"
import { aEstado, MENSAJE_ENLACE_MANUAL, type EstadoForm } from "@/lib/resultado"
import { campos, idValido } from "@/lib/validacion"
import { cambiarEstadoUsuario, crearUsuario, editarUsuario, reenviarInvitacion } from "@/lib/usuarios"

const CAMPOS = ["nombre", "apellido", "email", "rol", "usuarioGithub"]

export async function crearUsuarioAction(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const ctx = await ctxLider()
  const r = await crearUsuario(ctx, campos(formData, CAMPOS))
  if (r.ok) revalidatePath("/usuarios")
  if (r.ok && r.valor.enlace) return { ok: `Cuenta creada. ${MENSAJE_ENLACE_MANUAL}`, enlace: r.valor.enlace }
  return aEstado(r, "Cuenta creada. Se envió la invitación para que defina su contraseña.")
}

export async function editarUsuarioAction(id: number, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const ctx = await ctxLider()
  const uid = idValido(id)
  if (!uid) return { error: "Cuenta no válida." }
  const r = await editarUsuario(ctx, uid, campos(formData, CAMPOS))
  if (r.ok) revalidatePath("/usuarios")
  return aEstado(r, "Cambios guardados.")
}

export async function cambiarEstadoUsuarioAction(id: number, activo: boolean, _prev: EstadoForm): Promise<EstadoForm> {
  const ctx = await ctxLider()
  const uid = idValido(id)
  if (!uid) return { error: "Cuenta no válida." }
  const r = await cambiarEstadoUsuario(ctx, uid, activo)
  if (r.ok) revalidatePath("/usuarios")
  return aEstado(r, activo ? "Cuenta activada." : "Cuenta desactivada.")
}

export async function reenviarInvitacionAction(id: number, _prev: EstadoForm): Promise<EstadoForm> {
  const ctx = await ctxLider()
  const uid = idValido(id)
  if (!uid) return { error: "Cuenta no válida." }
  const r = await reenviarInvitacion(ctx, uid)
  if (r.ok && r.valor.enlace) return { ok: `Enlace nuevo generado. ${MENSAJE_ENLACE_MANUAL}`, enlace: r.valor.enlace }
  return aEstado(r, "Invitación reenviada.")
}
