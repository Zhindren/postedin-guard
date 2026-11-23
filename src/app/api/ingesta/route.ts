import { after } from "next/server"
import { ipDesdeHeaders } from "@/lib/audit"
import { avisarEscaneoEnRojo } from "@/lib/avisos"
import { extraerBearer } from "@/lib/tokens"
import { esquemaIngesta } from "@/lib/ingesta/esquema"
import { excedeLimite, procesarIngesta, repositorioPorToken } from "@/lib/ingesta/procesar"

const LOG = "[ingesta]"
const MAX_BYTES = 5 * 1024 * 1024

/** Recibe desde GitHub Actions el análisis de un commit. Se autentica con el token del repositorio. */
export async function POST(req: Request): Promise<Response> {
  const t0 = Date.now()
  const ip = ipDesdeHeaders(req.headers)
  const token = extraerBearer(req.headers.get("authorization"))
  const repo = token ? await repositorioPorToken(token) : null
  if (!repo) {
    console.warn(`${LOG} token inválido o revocado ip=${ip ?? "?"}`)
    return Response.json({ error: "Token inválido o revocado" }, { status: 401 })
  }
  if (await excedeLimite(repo.id)) {
    console.warn(`${LOG} límite excedido repo=${repo.id}`)
    return Response.json({ error: "Demasiadas solicitudes: máximo 60 por minuto" }, { status: 429, headers: { "Retry-After": "60" } })
  }
  const largo = Number(req.headers.get("content-length") ?? 0)
  if (largo > MAX_BYTES) return Response.json({ error: "El análisis supera los 5 MB" }, { status: 413 })

  let cuerpo: unknown
  try {
    const texto = await req.text()
    if (texto.length > MAX_BYTES) return Response.json({ error: "El análisis supera los 5 MB" }, { status: 413 })
    cuerpo = JSON.parse(texto)
  } catch {
    return Response.json({ error: "El cuerpo debe ser JSON" }, { status: 400 })
  }
  const p = esquemaIngesta.safeParse(cuerpo)
  if (!p.success) {
    const issue = p.error.issues[0]
    return Response.json({ error: `Datos inválidos: ${issue.path.join(".")} ${issue.message}` }, { status: 400 })
  }

  console.info(`${LOG} recibido repo=${repo.id} commit=${p.data.commitSha.slice(0, 7)} hallazgos=${p.data.hallazgos.length}`)
  try {
    const recibido = new Date()
    const r = await procesarIngesta(repo, p.data, ip, recibido)
    after(() => avisarEscaneoEnRojo(r.escaneoId, recibido))
    console.info(`${LOG} listo repo=${repo.id} escaneo=${r.escaneoId} resultado=${r.resultado} nuevos=${r.hallazgosNuevos} ms=${Date.now() - t0}`)
    return Response.json(r, { status: 201 })
  } catch (e) {
    console.error(`${LOG} error repo=${repo.id}`, (e as Error).message)
    return Response.json({ error: "No se pudo registrar el análisis" }, { status: 500 })
  }
}
