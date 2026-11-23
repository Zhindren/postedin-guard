import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  detectarSqlFueraDeMigraciones, parsearGitleaks, parsearNpmAudit, parsearPruebas, parsearSemgrep, unicos,
} from "./parsers.mjs"
import { construirPayload, contextoGit, leerArgs, resumenMarkdown } from "./guard-scan.mjs"

const fixture = (n) => JSON.parse(readFileSync(path.join(__dirname, "fixtures", n), "utf8"))

describe("parsearGitleaks", () => {
  it("normaliza sin conservar el secreto ni el match", () => {
    const [h] = parsearGitleaks(fixture("gitleaks.json"))
    expect(h).toMatchObject({
      herramienta: "gitleaks", categoria: "Secreto expuesto", severidad: "Crítica",
      rutaArchivo: "src/config/integraciones.ts", linea: 18, regla: "generic-api-key",
    })
    expect(h.huella).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(h)).not.toContain("REDACTED")
  })

  it("descarta el secreto aunque gitleaks se haya ejecutado sin --redact", () => {
    const [h] = parsearGitleaks([{ File: "a.ts", StartLine: 1, RuleID: "generic-api-key", Secret: "valor-de-prueba-no-real", Match: "key=valor-de-prueba-no-real" }])
    expect(JSON.stringify(h)).not.toContain("valor-de-prueba-no-real")
  })

  it("tolera reportes vacíos o inválidos", () => {
    expect(parsearGitleaks(null)).toEqual([])
    expect(parsearGitleaks({})).toEqual([])
  })
})

describe("parsearNpmAudit", () => {
  it("un hallazgo por advisory y sin repetir los transitivos", () => {
    const hs = parsearNpmAudit(fixture("npm-audit.json"))
    expect(hs.map((h) => [h.titulo, h.severidad])).toEqual([
      ["lodash: Prototype Pollution in lodash", "Alta"],
      ["minimist: Prototype Pollution in minimist", "Crítica"],
    ])
    expect(hs[0].descripcion).toContain("Dependencia directa")
    expect(hs[1].descripcion).toContain("Aún no hay corrección")
  })

  it("otro lockfile se registra con su ruta y no choca con el de la raíz", () => {
    const raiz = parsearNpmAudit(fixture("npm-audit.json"))
    const guard = parsearNpmAudit(fixture("npm-audit.json"), "guard/package-lock.json")
    expect(guard[0].rutaArchivo).toBe("guard/package-lock.json")
    expect(raiz[0].rutaArchivo).toBe("package-lock.json")
    expect(guard[0].huella).not.toBe(raiz[0].huella)
  })

  it("devuelve vacío si no hay vulnerabilidades", () => {
    expect(parsearNpmAudit({ vulnerabilities: {} })).toEqual([])
    expect(parsearNpmAudit(undefined)).toEqual([])
  })
})

describe("parsearSemgrep", () => {
  it("respeta la categoría y severidad de las reglas propias y no envía código", () => {
    const [a, b] = parsearSemgrep(fixture("semgrep.json"))
    expect(a).toMatchObject({ categoria: "Permisos de API", severidad: "Alta", linea: 12 })
    expect(b).toMatchObject({ categoria: "Código inseguro", severidad: "Media" })
    expect(JSON.stringify([a, b])).not.toContain("export async function GET")
  })

  it("la huella no cambia si el código solo se movió de línea", () => {
    const base = fixture("semgrep.json")
    const movido = structuredClone(base)
    movido.results[0].start.line = 30
    expect(parsearSemgrep(movido)[0].huella).toBe(parsearSemgrep(base)[0].huella)
  })
})

describe("SQL fuera de migraciones y pruebas", () => {
  it("agrupa por carpeta e ignora prisma/migrations", () => {
    const hs = detectarSqlFueraDeMigraciones([
      "docs/db/2026-08-06-a.sql", "docs/db/2026-08-10-b.sql", "prisma/migrations/1_init/migration.sql", "guard/prisma/migrations/2/migration.sql",
    ])
    expect(hs).toHaveLength(1)
    expect(hs[0].titulo).toBe("2 scripts SQL fuera de las migraciones en docs/db")
  })

  it("lee pruebas fallidas y cobertura", () => {
    expect(parsearPruebas(fixture("vitest.json"), fixture("coverage-summary.json")))
      .toEqual({ pruebasFallidas: 2, pruebasTotales: 120, cobertura: 72.3 })
    expect(parsearPruebas(undefined, undefined)).toEqual({ pruebasFallidas: 0, pruebasTotales: null, cobertura: null })
  })

  it("unicos quita huellas repetidas", () => {
    const h = parsearGitleaks(fixture("gitleaks.json"))[0]
    expect(unicos([h, { ...h }])).toHaveLength(1)
  })
})

describe("guard-scan", () => {
  it("lee argumentos con y sin valor", () => {
    expect(leerArgs(["--gitleaks", "g.json", "--sql", "--pr", "4"])).toEqual({ gitleaks: "g.json", sql: true, pr: "4" })
  })

  it("en un pull_request usa el sha de la cabeza del PR, no el merge commit", () => {
    const ctx = contextoGit(
      { GITHUB_SHA: "f".repeat(40), GITHUB_HEAD_REF: "feature/x", GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "postedin/apps", GITHUB_RUN_ID: "9" },
      {},
      { pull_request: { number: 87, head: { sha: "A".repeat(40) }, user: { login: "smaldonado" } } },
    )
    expect(ctx).toEqual({
      commitSha: "a".repeat(40), ramaOrigen: "feature/x", numeroPr: 87, autorGithub: "smaldonado",
      urlEjecucion: "https://github.com/postedin/apps/actions/runs/9",
    })
  })

  it("solo declara como ejecutadas las herramientas con reporte", () => {
    const p = construirPayload({
      contexto: { commitSha: "a".repeat(40), ramaOrigen: "main", numeroPr: null, autorGithub: "x", urlEjecucion: null },
      reportes: { gitleaks: fixture("gitleaks.json"), npmAudit: undefined, semgrep: undefined, vitest: fixture("vitest.json"), cobertura: undefined },
      sqlArchivos: undefined,
    })
    expect(p.herramientasEjecutadas).toEqual(["gitleaks", "Vitest"])
    expect(p.hallazgos).toHaveLength(1)
    expect(p.pruebasFallidas).toBe(2)
  })

  it("junta los npm audit de varios lockfiles en una sola herramienta", () => {
    const p = construirPayload({
      contexto: { commitSha: "a".repeat(40), ramaOrigen: "main", numeroPr: null, autorGithub: "x", urlEjecucion: null },
      reportes: { npmAudits: [{ lock: "package-lock.json", json: fixture("npm-audit.json") }, { lock: "guard/package-lock.json", json: fixture("npm-audit.json") }] },
      sqlArchivos: undefined,
    })
    expect(p.herramientasEjecutadas).toEqual(["npm audit"])
    expect(p.hallazgos.map((h) => h.rutaArchivo)).toEqual(["package-lock.json", "package-lock.json", "guard/package-lock.json", "guard/package-lock.json"])
  })

  it("arma el resumen para GitHub", () => {
    const md = resumenMarkdown({ resultado: "BLOQUEADO", motivos: ["2 pruebas fallidas."], hallazgosNuevos: 1, url: "http://g/escaneos/1" },
      { commitSha: "abcdef1234", hallazgos: [{}] })
    expect(md).toContain("🔴 Postedin Guard: BLOQUEADO")
    expect(md).toContain("- 2 pruebas fallidas.")
  })
})
