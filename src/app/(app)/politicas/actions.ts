"use server"

import { revalidatePath } from "next/cache"
import { ctxLider } from "@/lib/acciones"
import { aEstado, type EstadoForm } from "@/lib/resultado"
import { campos, idValido } from "@/lib/validacion"
import { asignarPoliticas, cambiarEstadoPolitica, crearPolitica, editarPolitica } from "@/lib/politicas"

const CAMPOS = ["nombre", "descripcion", "severidadBloqueoId", "coberturaMinima", "exigeChecklistIa"]

export async function crearPoliticaAction(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const ctx = await ctxLider()
  const r = await crearPolitica(ctx, campos(formData, CAMPOS))
  if (r.ok) revalidatePath("/politicas")
  return aEstado(r, "Política creada. Asígnala a los repositorios desde su ficha.")
}

export async function editarPoliticaAction(id: number, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const ctx = await ctxLider()
  const pid = idValido(id)
  if (!pid) return { error: "Política no válida." }
  const r = await editarPolitica(ctx, pid, campos(formData, CAMPOS))
  if (r.ok) revalidatePath("/politicas")
  return aEstado(r, "Política actualizada. Se aplica desde el próximo análisis.")
}

export async function cambiarEstadoPoliticaAction(id: number, activa: boolean, _prev: EstadoForm): Promise<EstadoForm> {
  const ctx = await ctxLider()
  const pid = idValido(id)
  if (!pid) return { error: "Política no válida." }
  const r = await cambiarEstadoPolitica(ctx, pid, activa)
  if (r.ok) revalidatePath("/politicas")
  return aEstado(r, activa ? "Política activada." : "Política desactivada.")
}

export async function asignarPoliticasAction(repositorioId: number, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const ctx = await ctxLider()
  const rid = idValido(repositorioId)
  if (!rid) return { error: "Repositorio no válido." }
  const ids = formData.getAll("politica").map(idValido)
  if (ids.some((x) => x === null)) return { error: "Selección no válida." }
  const r = await asignarPoliticas(ctx, rid, ids as number[])
  if (r.ok) revalidatePath(`/repositorios/${rid}`)
  return aEstado(r, "Políticas del repositorio actualizadas.")
}
