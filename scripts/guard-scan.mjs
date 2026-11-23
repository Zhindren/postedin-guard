#!/usr/bin/env node
// Envía a Postedin Guard el resultado de los análisis de un commit y aplica el quality gate.
//
// Uso en CI (ver .github/workflows/guard-scan.yml):
//   node guard/scripts/guard-scan.mjs --gitleaks gitleaks.json --npm-audit npm-audit.json[,guard/package-lock.json=npm-audit-guard.json] \
//     --semgrep semgrep.json --vitest vitest.json [--coverage coverage/coverage-summary.json] [--sql]
// Variables: GUARD_URL, GUARD_TOKEN y GUARD_ENFORCE ("true" para que BLOQUEADO falle el job).
// Un reporte ausente significa que esa herramienta no corrió: Guard no da por resueltos sus hallazgos.

import { execFileSync } from "node:child_process"
import { appendFileSync, existsSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import {
  detectarSqlFueraDeMigraciones, parsearGitleaks, parsearNpmAudit, parsearPruebas, parsearSemgrep, unicos,
} from "./parsers.mjs"

export function leerArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("--")) continue
    const clave = a.slice(2)
    const sig = argv[i + 1]
    if (sig === undefined || sig.startsWith("--")) args[clave] = true
    else { args[clave] = sig; i++ }
  }
  return args
}

function leerJson(ruta) {
  if (!ruta || ruta === true || !existsSync(ruta)) return undefined
  const texto = readFileSync(ruta, "utf8").trim()
  if (!texto) return undefined
  return JSON.parse(texto)
}

/** `--npm-audit a.json,guard/package-lock.json=b.json`: sin `lock=`, el reporte es del lock de la raíz. */
export function leerAudits(valor) {
  if (!valor || valor === true) return []
  return String(valor).split(",").filter(Boolean).map((e) => {
    const i = e.indexOf("=")
    return i === -1 ? { lock: "package-lock.json", json: leerJson(e) } : { lock: e.slice(0, i), json: leerJson(e.slice(i + 1)) }
  })
}

/** Datos del commit desde el evento de GitHub Actions, con overrides por argumento para uso local. */
export function contextoGit(env, args, evento) {
  const pr = evento?.pull_request
  const commitSha = String(args.commit ?? pr?.head?.sha ?? env.GITHUB_SHA ?? "").toLowerCase()
  const ramaOrigen = String(args.rama ?? (pr ? env.GITHUB_HEAD_REF : env.GITHUB_REF_NAME) ?? "")
  const numeroPr = args.pr !== undefined ? Number(args.pr) : pr?.number ?? null
  const autorGithub = String(args.autor ?? pr?.user?.login ?? env.GITHUB_ACTOR ?? "desconocido")
  const urlEjecucion = env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
    ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
    : null
  return { commitSha, ramaOrigen, numeroPr: Number.isInteger(numeroPr) ? numeroPr : null, autorGithub, urlEjecucion }
}

export function construirPayload({ contexto, reportes, sqlArchivos }) {
  const herramientasEjecutadas = []
  const hallazgos = []
  if (reportes.gitleaks !== undefined) { herramientasEjecutadas.push("gitleaks"); hallazgos.push(...parsearGitleaks(reportes.gitleaks)) }
  const audits = (reportes.npmAudits ?? []).filter((a) => a.json !== undefined)
  if (reportes.npmAudit !== undefined) audits.unshift({ lock: "package-lock.json", json: reportes.npmAudit })
  if (audits.length > 0) {
    herramientasEjecutadas.push("npm audit")
    for (const a of audits) hallazgos.push(...parsearNpmAudit(a.json, a.lock))
  }
  if (reportes.semgrep !== undefined || sqlArchivos !== undefined) herramientasEjecutadas.push("Semgrep")
  if (reportes.semgrep !== undefined) hallazgos.push(...parsearSemgrep(reportes.semgrep))
  if (sqlArchivos !== undefined) hallazgos.push(...detectarSqlFueraDeMigraciones(sqlArchivos))
  const pruebas = parsearPruebas(reportes.vitest, reportes.cobertura)
  if (reportes.vitest !== undefined) herramientasEjecutadas.push("Vitest")
  return {
    ...contexto,
    herramientasEjecutadas,
    pruebasFallidas: pruebas.pruebasFallidas,
    pruebasTotales: pruebas.pruebasTotales,
    cobertura: pruebas.cobertura,
    hallazgos: unicos(hallazgos),
  }
}

export function resumenMarkdown(respuesta, payload) {
  const icono = respuesta.resultado === "APROBADO" ? "🟢" : respuesta.resultado === "ERROR" ? "⚪" : "🔴"
  const lineas = [
    `## ${icono} Postedin Guard: ${respuesta.resultado}`,
    "",
    `Commit \`${payload.commitSha.slice(0, 7)}\` · ${payload.hallazgos.length} hallazgos (${respuesta.hallazgosNuevos ?? 0} nuevos)`,
  ]
  if (respuesta.motivos?.length) lineas.push("", ...respuesta.motivos.map((m) => `- ${m}`))
  if (respuesta.url) lineas.push("", `[Ver el análisis en Postedin Guard](${respuesta.url})`)
  return lineas.join("\n") + "\n"
}

async function main() {
  const args = leerArgs(process.argv.slice(2))
  const env = process.env
  const evento = env.GITHUB_EVENT_PATH && existsSync(env.GITHUB_EVENT_PATH) ? leerJson(env.GITHUB_EVENT_PATH) : undefined
  const sqlArchivos = args.sql
    ? execFileSync("git", ["ls-files", "*.sql"], { encoding: "utf8" }).split("\n").filter(Boolean)
    : undefined
  const payload = construirPayload({
    contexto: contextoGit(env, args, evento),
    reportes: {
      gitleaks: leerJson(args.gitleaks),
      npmAudits: leerAudits(args["npm-audit"]),
      semgrep: leerJson(args.semgrep),
      vitest: leerJson(args.vitest),
      cobertura: leerJson(args.coverage),
    },
    sqlArchivos,
  })

  if (args["dry-run"]) {
    console.log(JSON.stringify(payload, null, 2))
    return
  }

  const enforce = String(env.GUARD_ENFORCE ?? "").toLowerCase() === "true"
  const url = String(env.GUARD_URL ?? "").replace(/\/+$/, "")
  if (!url || !env.GUARD_TOKEN) {
    console.error("Faltan GUARD_URL o GUARD_TOKEN.")
    process.exit(enforce ? 1 : 0)
  }

  console.log(`[guard-scan] enviando ${payload.hallazgos.length} hallazgos de ${payload.herramientasEjecutadas.join(", ") || "ninguna herramienta"}`)
  let res
  try {
    res = await fetch(`${url}/api/ingesta`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GUARD_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (e) {
    console.error(`[guard-scan] no se pudo contactar a Guard: ${e.message}`)
    process.exit(enforce ? 1 : 0)
  }
  const cuerpo = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(`[guard-scan] Guard respondió ${res.status}: ${cuerpo.error ?? "sin detalle"}`)
    process.exit(enforce ? 1 : 0)
  }

  const md = resumenMarkdown(cuerpo, payload)
  console.log(md)
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, md)
  if (cuerpo.resultado !== "APROBADO") {
    if (enforce) process.exit(1)
    console.log("[guard-scan] GUARD_ENFORCE no está activo: el resultado solo se informa.")
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
