import { esProduccion } from "@/lib/env"

type Correo = { para: string; asunto: string; texto: string }

/**
 * Envía con Resend si hay API key. Sin ella, en desarrollo el contenido va a la consola del
 * servidor; en producción no se imprime nunca, porque podría contener un enlace de acceso.
 */
export async function enviarCorreo(c: Correo): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    if (!esProduccion()) {
      console.info(`[correo:dev] para=${c.para} asunto="${c.asunto}"\n${c.texto}`)
      return true
    }
    console.warn("[correo] RESEND_API_KEY no configurada: no se envió", c.asunto)
    return false
  }
  const t0 = Date.now()
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.GUARD_MAIL_FROM ?? "Postedin Guard <guard@postedin.com>",
        to: [c.para],
        subject: c.asunto,
        text: c.texto,
      }),
    })
    console.info(`[correo] resend status=${res.status} ms=${Date.now() - t0}`)
    return res.ok
  } catch (err) {
    console.error("[correo] fallo al enviar", (err as Error).message)
    return false
  }
}
