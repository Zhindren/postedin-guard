import { prisma } from "@/lib/db"

export type EventoAuditoria = {
  usuarioId?: number | null
  accion: string
  entidad: string
  entidadId?: number | null
  detalle?: string | null
  ip?: string | null
}

/** Escribe en la bitácora sin lanzar nunca: un fallo de auditoría no debe romper la acción. */
export async function registrarEvento(e: EventoAuditoria): Promise<void> {
  try {
    await prisma.bitacoraAuditoria.create({
      data: {
        usuarioId: e.usuarioId ?? null,
        accion: e.accion.slice(0, 40),
        entidad: e.entidad.slice(0, 40),
        entidadId: e.entidadId ?? null,
        detalle: e.detalle ? e.detalle.slice(0, 255) : null,
        direccionIp: e.ip ? e.ip.slice(0, 45) : null,
      },
    })
  } catch (err) {
    console.error("[auditoria] no se pudo registrar", e.accion, (err as Error).message)
  }
}

export function ipDesdeHeaders(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim() || null
  return h.get("x-real-ip")
}
