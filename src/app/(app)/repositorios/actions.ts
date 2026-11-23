"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ctxLider } from "@/lib/acciones"
import { aEstado, type EstadoForm } from "@/lib/resultado"
import { campos, idValido } from "@/lib/validacion"
import {
  cambiarEstadoRepositorio, crearRepositorio, editarRepositorio, emitirToken, revocarToken,
} from "@/lib/repositorios"

const CAMPOS = ["nombre", "urlGithub", "ramaPrincipal", "responsableId"]

export async function crearRepositorioAction(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const ctx = await ctxLider()
  const r = await crearRepositorio(ctx, campos(formData, CAMPOS))
  if (!r.ok) return { error: r.error }
  revalidatePath("/repositorios")
  redirect(`/repositorios/${r.valor}`)
}

export async function editarRepositorioAction(id: number, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const ctx = await ctxLider()
  const rid = idValido(id)
  if (!rid) return { error: "Repositorio no válido." }
  const r = await editarRepositorio(ctx, rid, campos(formData, CAMPOS))
  if (r.ok) revalidatePath(`/repositorios/${rid}`)
  return aEstado(r, "Cambios guardados.")
}

export async function cambiarEstadoRepositorioAction(id: number, activo: boolean, _prev: EstadoForm): Promise<EstadoForm> {
  const ctx = await ctxLider()
  const rid = idValido(id)
  if (!rid) return { error: "Repositorio no válido." }
  const r = await cambiarEstadoRepositorio(ctx, rid, activo)
  if (r.ok) revalidatePath(`/repositorios/${rid}`)
  return aEstado(r, activo ? "Repositorio activado." : "Repositorio desactivado y token revocado.")
}

export async function emitirTokenAction(id: number, _prev: EstadoForm): Promise<EstadoForm> {
  const ctx = await ctxLider()
  const rid = idValido(id)
  if (!rid) return { error: "Repositorio no válido." }
  const r = await emitirToken(ctx, rid)
  if (!r.ok) return { error: r.error }
  revalidatePath(`/repositorios/${rid}`)
  return { ok: "Token generado. Cópialo ahora: no se volverá a mostrar.", token: r.valor }
}

export async function revocarTokenAction(id: number, _prev: EstadoForm): Promise<EstadoForm> {
  const ctx = await ctxLider()
  const rid = idValido(id)
  if (!rid) return { error: "Repositorio no válido." }
  const r = await revocarToken(ctx, rid)
  if (r.ok) revalidatePath(`/repositorios/${rid}`)
  return aEstado(r, "Token revocado. Los análisis con ese token serán rechazados.")
}
