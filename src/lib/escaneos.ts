import { z } from "zod"
import { prisma } from "@/lib/db"
import { registrarEvento } from "@/lib/audit"
import { exito, fallo, type Resultado } from "@/lib/resultado"
import { checklistCompleto } from "@/lib/checklist"
import { exigeChecklist, resultadoFinal } from "@/lib/gate"
import { politicasDelRepositorio } from "@/lib/ingesta/procesar"
import type { SesionGuard } from "@/lib/auth/guards"

type Ctx = { actor: SesionGuard; ip: string | null }

const respuesta = z
  .object({ itemId: z.number().int().positive(), cumple: z.boolean(), observacion: z.string().trim().max(255) })
  .refine((r) => r.cumple || r.observacion.length >= 5, { message: "Explica en la observación por qué un ítem no se cumple." })

/** Lee las respuestas del formulario: `cumple_<id>` = "si" | "no" y `obs_<id>` opcional. */
export function leerRespuestas(formData: FormData, itemIds: number[]) {
  return itemIds.map((id) => {
    const v = formData.get(`cumple_${id}`)
    return {
      itemId: id,
      cumple: v === "si" ? true : v === "no" ? false : null,
      observacion: String(formData.get(`obs_${id}`) ?? ""),
    }
  })
}

/** Recalcula el resultado del escaneo; el análisis no cambia, solo el efecto del checklist. */
export async function reevaluarEscaneo(escaneoId: number): Promise<"APROBADO" | "BLOQUEADO" | "ERROR"> {
  const e = await prisma.escaneo.findUniqueOrThrow({ where: { id: escaneoId }, select: { repositorioId: true, resultadoAnalisis: true } })
  if (e.resultadoAnalisis === "ERROR") return "ERROR"
  const politicas = await politicasDelRepositorio(e.repositorioId)
  const final = resultadoFinal(e.resultadoAnalisis, exigeChecklist(politicas), await checklistCompleto(escaneoId))
  await prisma.escaneo.update({ where: { id: escaneoId }, data: { resultado: final.resultado } })
  return final.resultado
}

export async function guardarChecklist(
  ctx: Ctx,
  escaneoId: number,
  respuestas: { itemId: number; cumple: boolean | null; observacion: string }[],
): Promise<Resultado<"APROBADO" | "BLOQUEADO" | "ERROR">> {
  const escaneo = await prisma.escaneo.findUnique({ where: { id: escaneoId }, select: { id: true } })
  if (!escaneo) return fallo("El escaneo no existe.")
  const activos = new Set((await prisma.itemChecklist.findMany({ where: { activo: true }, select: { id: true } })).map((i) => i.id))
  const contestadas = respuestas.filter((r) => r.cumple !== null && activos.has(r.itemId))
  if (contestadas.length < activos.size) return fallo("Responde todos los ítems del checklist.")
  const validas = []
  for (const r of contestadas) {
    const p = respuesta.safeParse(r)
    if (!p.success) return fallo(p.error.issues[0].message)
    validas.push(p.data)
  }
  await prisma.$transaction(
    validas.map((r) =>
      prisma.respuestaChecklist.upsert({
        where: { escaneoId_itemId: { escaneoId, itemId: r.itemId } },
        update: { cumple: r.cumple, observacion: r.observacion || null, usuarioId: ctx.actor.id, fechaRespuesta: new Date() },
        create: { escaneoId, itemId: r.itemId, cumple: r.cumple, observacion: r.observacion || null, usuarioId: ctx.actor.id },
      }),
    ),
  )
  const resultado = await reevaluarEscaneo(escaneoId)
  const noCumple = validas.filter((r) => !r.cumple).length
  await registrarEvento({
    usuarioId: ctx.actor.id, accion: "CHECKLIST_RESPONDIDO", entidad: "escaneo", entidadId: escaneoId,
    detalle: `${validas.length - noCumple} cumplen, ${noCumple} no cumplen; resultado ${resultado}`, ip: ctx.ip,
  })
  return exito(resultado)
}
