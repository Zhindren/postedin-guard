"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { avisarAsignacion } from "@/lib/avisos"
import { ctxLider, ctxUsuario } from "@/lib/acciones"
import { aEstado, type EstadoForm } from "@/lib/resultado"
import { idValido } from "@/lib/validacion"
import { asignar, cambiarEstado, comentar } from "@/lib/hallazgos"

export async function cambiarEstadoAction(id: number, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const ctx = await ctxUsuario()
  const hid = idValido(id)
  if (!hid) return { error: "Hallazgo no válido." }
  const r = await cambiarEstado(ctx, hid, { estado: formData.get("estado"), justificacion: String(formData.get("justificacion") ?? "") })
  if (r.ok) revalidatePath(`/hallazgos/${hid}`)
  return aEstado(r, "Estado actualizado.")
}

export async function asignarAction(id: number, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const ctx = await ctxLider()
  const hid = idValido(id)
  if (!hid) return { error: "Hallazgo no válido." }
  const valor = String(formData.get("asignadoId") ?? "")
  const usuarioId = valor === "" ? null : idValido(valor)
  if (valor !== "" && !usuarioId) return { error: "Responsable no válido." }
  const r = await asignar(ctx, hid, usuarioId)
  if (r.ok) revalidatePath(`/hallazgos/${hid}`)
  if (r.ok && r.valor.avisar && usuarioId) after(() => avisarAsignacion(hid, usuarioId))
  return aEstado(r, "Responsable actualizado.")
}

export async function comentarAction(id: number, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const ctx = await ctxUsuario()
  const hid = idValido(id)
  if (!hid) return { error: "Hallazgo no válido." }
  const r = await comentar(ctx, hid, formData.get("contenido"))
  if (r.ok) revalidatePath(`/hallazgos/${hid}`)
  return aEstado(r, "Comentario agregado.")
}
