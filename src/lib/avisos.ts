import { prisma } from "@/lib/db"
import { urlPublica } from "@/lib/env"
import { enviarCorreo } from "@/lib/mail"

// Los avisos son solo alarmas: corren después de responder (after), nunca lanzan y nunca
// cambian el resultado de una asignación o de un análisis. Sin credenciales quedan apagados.

const LOG = "[avisos]"
const SLACK_TIMEOUT_MS = 10_000

export function slackConfigurado(env: Record<string, string | undefined> = process.env): { token: string; canal: string } | null {
  const token = env.SLACK_BOT_TOKEN?.trim()
  const canal = env.GUARD_SLACK_CHANNEL?.trim()
  return token && canal ? { token, canal } : null
}

/** Correo al Desarrollador cuando el Líder le asigna un hallazgo. */
export async function avisarAsignacion(hallazgoId: number, usuarioId: number): Promise<boolean> {
  try {
    const [h, u] = await Promise.all([
      prisma.hallazgo.findUnique({
        where: { id: hallazgoId },
        select: {
          titulo: true, rutaArchivo: true, linea: true,
          severidad: { select: { nombre: true } },
          escaneo: { select: { repositorio: { select: { nombre: true } } } },
        },
      }),
      prisma.usuario.findUnique({ where: { id: usuarioId }, select: { email: true, nombre: true, activo: true } }),
    ])
    if (!h || !u?.activo) return false
    const ubicacion = h.rutaArchivo ? `${h.rutaArchivo}${h.linea ? `:${h.linea}` : ""}` : "sin ubicación"
    const enviado = await enviarCorreo({
      para: u.email,
      asunto: `[Postedin Guard] Te asignaron un hallazgo ${h.severidad.nombre}`,
      texto: [
        `Hola ${u.nombre}:`,
        "",
        "Se te asignó este hallazgo en Postedin Guard:",
        "",
        `${h.titulo}`,
        `Severidad: ${h.severidad.nombre}`,
        `Repositorio: ${h.escaneo.repositorio.nombre}`,
        `Ubicación: ${ubicacion}`,
        "",
        `Revísalo aquí: ${urlPublica()}/hallazgos/${hallazgoId}`,
      ].join("\n"),
    })
    console.info(`${LOG} correo de asignación hallazgo=${hallazgoId} usuario=${usuarioId} enviado=${enviado}`)
    return enviado
  } catch (e) {
    console.error(`${LOG} no se pudo avisar la asignación hallazgo=${hallazgoId}`, (e as Error).message)
    return false
  }
}

export type ResumenEscaneo = {
  escaneoId: number
  repositorio: string
  rama: string
  numeroPr: number | null
  commitSha: string
  resultado: "APROBADO" | "BLOQUEADO" | "ERROR"
  motivo: string | null
  criticosNuevos: number
  /** El análisis anterior de la misma rama ya estaba BLOQUEADO (y ya se avisó). */
  previoBloqueado: boolean
}

/**
 * Solo lo que está "en rojo": hallazgos Críticos nuevos, o una rama que pasa a BLOQUEADO.
 * Un PR que sigue bloqueado en cada push no vuelve a avisar, para no inundar el canal.
 */
export function requiereAlarma(r: ResumenEscaneo): boolean {
  return r.criticosNuevos > 0 || (r.resultado === "BLOQUEADO" && !r.previoBloqueado)
}

export function mensajeSlack(r: ResumenEscaneo, url: string): string {
  const origen = r.numeroPr ? `PR #${r.numeroPr} (${r.rama})` : `rama ${r.rama}`
  const lineas = [
    `:rotating_light: *Postedin Guard* · ${r.repositorio} · ${origen} · \`${r.commitSha.slice(0, 7)}\``,
  ]
  if (r.resultado === "BLOQUEADO") lineas.push(`Análisis *BLOQUEADO*${r.motivo ? `: ${r.motivo}` : "."}`)
  if (r.criticosNuevos > 0) {
    lineas.push(`${r.criticosNuevos} ${r.criticosNuevos === 1 ? "hallazgo crítico nuevo" : "hallazgos críticos nuevos"}.`)
  }
  lineas.push(`_Solo es un aviso: no detiene el PR ni el deploy._ <${url}|Ver el análisis>`)
  return lineas.join("\n")
}

/** Aviso al canal del equipo cuando un análisis queda en rojo. */
export async function avisarEscaneoEnRojo(escaneoId: number, desde: Date): Promise<boolean> {
  const slack = slackConfigurado()
  if (!slack) return false
  try {
    const e = await prisma.escaneo.findUnique({
      where: { id: escaneoId },
      select: {
        repositorioId: true, ramaOrigen: true, numeroPr: true, commitSha: true, resultado: true, motivo: true,
        repositorio: { select: { nombre: true } },
      },
    })
    if (!e) return false
    const [criticosNuevos, previo] = await Promise.all([
      prisma.hallazgo.count({ where: { escaneoId, fechaDeteccion: { gte: desde }, severidad: { nombre: "Crítica" } } }),
      prisma.escaneo.findFirst({
        where: { repositorioId: e.repositorioId, ramaOrigen: e.ramaOrigen, id: { not: escaneoId } },
        orderBy: { fechaEjecucion: "desc" },
        select: { resultado: true },
      }),
    ])
    const resumen: ResumenEscaneo = {
      escaneoId, repositorio: e.repositorio.nombre, rama: e.ramaOrigen, numeroPr: e.numeroPr,
      commitSha: e.commitSha, resultado: e.resultado, motivo: e.motivo, criticosNuevos,
      previoBloqueado: previo?.resultado === "BLOQUEADO",
    }
    if (!requiereAlarma(resumen)) return false

    const t0 = Date.now()
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${slack.token}`, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ channel: slack.canal, text: mensajeSlack(resumen, `${urlPublica()}/escaneos/${escaneoId}`), unfurl_links: false }),
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    })
    const cuerpo = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    console.info(`${LOG} slack escaneo=${escaneoId} status=${res.status} ok=${cuerpo.ok ?? false} ms=${Date.now() - t0}${cuerpo.error ? ` error=${cuerpo.error}` : ""}`)
    return cuerpo.ok === true
  } catch (e) {
    console.error(`${LOG} no se pudo avisar a Slack escaneo=${escaneoId}`, (e as Error).message)
    return false
  }
}
