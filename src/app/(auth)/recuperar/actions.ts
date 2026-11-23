"use server"

import { headers } from "next/headers"
import { ipDesdeHeaders } from "@/lib/audit"
import { solicitarRecuperacion } from "@/lib/auth/recuperacion"

export type EstadoRecuperar = { enviado?: boolean }

export async function pedirEnlace(_prev: EstadoRecuperar, formData: FormData): Promise<EstadoRecuperar> {
  await solicitarRecuperacion(formData.get("email"), ipDesdeHeaders(await headers()))
  return { enviado: true }
}
