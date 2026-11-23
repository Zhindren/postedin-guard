import { prisma } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

type Cliente = Pick<Prisma.TransactionClient, "itemChecklist" | "respuestaChecklist">

/** Completo = todos los ítems activos tienen respuesta para ese escaneo. */
export async function checklistCompleto(escaneoId: number, db: Cliente = prisma): Promise<boolean> {
  const [activos, respondidos] = await Promise.all([
    db.itemChecklist.count({ where: { activo: true } }),
    db.respuestaChecklist.count({ where: { escaneoId, item: { activo: true } } }),
  ])
  return activos === 0 || respondidos >= activos
}
