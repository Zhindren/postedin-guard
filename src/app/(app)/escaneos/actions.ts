"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { ctxUsuario } from "@/lib/acciones"
import type { EstadoForm } from "@/lib/resultado"
import { idValido } from "@/lib/validacion"
import { guardarChecklist, leerRespuestas } from "@/lib/escaneos"

export async function guardarChecklistAction(escaneoId: number, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const ctx = await ctxUsuario()
  const eid = idValido(escaneoId)
  if (!eid) return { error: "Escaneo no válido." }
  const items = await prisma.itemChecklist.findMany({ where: { activo: true }, select: { id: true } })
  const r = await guardarChecklist(ctx, eid, leerRespuestas(formData, items.map((i) => i.id)))
  if (!r.ok) return { error: r.error }
  revalidatePath(`/escaneos/${eid}`)
  return {
    ok: r.valor === "APROBADO"
      ? "Checklist guardado. El escaneo quedó APROBADO: vuelve a ejecutar el job de Guard en GitHub para destrabar el PR."
      : "Checklist guardado. El escaneo sigue BLOQUEADO por los hallazgos o las pruebas.",
  }
}
