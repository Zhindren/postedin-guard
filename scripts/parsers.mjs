// Normaliza los reportes de las herramientas de análisis al formato que recibe Postedin Guard.
// Corre en el runner de CI sin dependencias. Nunca envía código ni el valor de un secreto:
// solo archivo, línea, regla y una huella para reconocer el mismo hallazgo entre análisis.

import { createHash } from "node:crypto"

/** @typedef {"Crítica" | "Alta" | "Media" | "Baja"} Severidad */
/**
 * @typedef {Object} Hallazgo
 * @property {string} herramienta
 * @property {string} categoria
 * @property {Severidad} severidad
 * @property {string} titulo
 * @property {string | null} descripcion
 * @property {string | null} rutaArchivo
 * @property {number | null} linea
 * @property {string | null} regla
 * @property {string} huella
 */

export const CATEGORIAS = {
  SECRETO: "Secreto expuesto",
  DEPENDENCIA: "Dependencia vulnerable",
  PERMISOS: "Permisos de API",
  SESIONES: "Gestión de sesiones",
  CODIGO: "Código inseguro",
  MIGRACIONES: "Migraciones",
  CALIDAD: "Calidad y pruebas",
  DOCUMENTACION: "Documentación",
}

const SEVERIDADES = ["Crítica", "Alta", "Media", "Baja"]

export function huella(...partes) {
  return createHash("sha256").update(partes.map((p) => String(p ?? "")).join("|")).digest("hex")
}

function recortar(v, max) {
  if (v === null || v === undefined) return null
  const s = String(v).replace(/\s+/g, " ").trim()
  return s ? s.slice(0, max) : null
}

function lineaValida(n) {
  const v = Number(n)
  return Number.isInteger(v) && v > 0 ? v : null
}

function rutaRelativa(p) {
  if (!p) return null
  return String(p).replace(/\\/g, "/").replace(/^\.\//, "").slice(0, 255)
}

/**
 * gitleaks `detect --report-format json --redact`. Se descartan `Secret` y `Match` aunque vengan:
 * el valor nunca sale del runner.
 * @returns {Hallazgo[]}
 */
export function parsearGitleaks(json) {
  if (!Array.isArray(json)) return []
  return json.map((r) => {
    const ruta = rutaRelativa(r.File)
    const linea = lineaValida(r.StartLine)
    const regla = recortar(r.RuleID, 120) ?? "secreto"
    return {
      herramienta: "gitleaks",
      categoria: CATEGORIAS.SECRETO,
      severidad: "Crítica",
      titulo: recortar(`${r.Description || "Secreto expuesto"} en ${ruta ?? "el repositorio"}`, 150),
      descripcion: "Se detectó una credencial en el código. Rótala en el proveedor y muévela a variables de entorno; borrarla del archivo no basta si ya está en el historial.",
      rutaArchivo: ruta,
      linea,
      regla,
      huella: huella("gitleaks", regla, ruta, linea),
    }
  })
}

const SEVERIDAD_NPM = { critical: "Crítica", high: "Alta", moderate: "Media", low: "Baja", info: "Baja" }

/**
 * `npm audit --json` (npm 7 o superior). Un hallazgo por paquete con advisory propio; los que
 * solo heredan la vulnerabilidad de otro paquete no se repiten.
 * @returns {Hallazgo[]}
 */
/** `rutaLock` distingue los lockfiles de un mismo repo; el de la raíz conserva su huella original. */
export function parsearNpmAudit(json, rutaLock = "package-lock.json") {
  const vulns = json && typeof json === "object" ? json.vulnerabilities : null
  if (!vulns || typeof vulns !== "object") return []
  const out = []
  for (const [nombre, v] of Object.entries(vulns)) {
    const advisories = Array.isArray(v?.via) ? v.via.filter((x) => x && typeof x === "object") : []
    for (const a of advisories) {
      const id = recortar(a.url, 120) ?? recortar(a.source, 120) ?? recortar(a.title, 120)
      out.push({
        herramienta: "npm audit",
        categoria: CATEGORIAS.DEPENDENCIA,
        severidad: SEVERIDAD_NPM[a.severity] ?? SEVERIDAD_NPM[v.severity] ?? "Media",
        titulo: recortar(`${nombre}: ${a.title || "vulnerabilidad conocida"}`, 150),
        descripcion: recortar(
          `Versiones afectadas: ${a.range || v.range || "sin dato"}. ${v.isDirect ? "Dependencia directa." : "Dependencia transitiva."} ${
            v.fixAvailable ? "Hay una versión corregida disponible." : "Aún no hay corrección publicada."
          }`,
          1000,
        ),
        rutaArchivo: rutaLock,
        linea: null,
        regla: id,
        huella: rutaLock === "package-lock.json" ? huella("npm audit", nombre, id) : huella("npm audit", rutaLock, nombre, id),
      })
    }
  }
  return out
}

const SEVERIDAD_SEMGREP = { ERROR: "Alta", WARNING: "Media", INFO: "Baja" }
const CATEGORIAS_VALIDAS = new Set(Object.values(CATEGORIAS))

/**
 * `semgrep --json`. Las reglas propias pueden fijar `metadata.guard_categoria` y
 * `metadata.guard_severidad`. El código de la línea solo se usa para la huella.
 * @returns {Hallazgo[]}
 */
export function parsearSemgrep(json) {
  const resultados = Array.isArray(json?.results) ? json.results : []
  return resultados.map((r) => {
    const meta = r.extra?.metadata ?? {}
    const ruta = rutaRelativa(r.path)
    const linea = lineaValida(r.start?.line)
    const regla = recortar(r.check_id, 120) ?? "semgrep"
    const severidad = SEVERIDADES.includes(meta.guard_severidad) ? meta.guard_severidad : SEVERIDAD_SEMGREP[r.extra?.severity] ?? "Media"
    const categoria = CATEGORIAS_VALIDAS.has(meta.guard_categoria) ? meta.guard_categoria : CATEGORIAS.CODIGO
    const codigo = typeof r.extra?.lines === "string" ? r.extra.lines.trim() : ""
    return {
      herramienta: "Semgrep",
      categoria,
      severidad,
      titulo: recortar(meta.guard_titulo ?? r.extra?.message ?? regla, 150),
      descripcion: recortar(r.extra?.message, 1000),
      rutaArchivo: ruta,
      linea,
      regla,
      huella: huella("Semgrep", regla, ruta, codigo || linea),
    }
  })
}

/**
 * Archivos .sql versionados fuera de la carpeta de migraciones: un hallazgo por carpeta, para
 * no generar uno por cada script manual.
 * @param {string[]} archivos rutas de `git ls-files "*.sql"`
 * @returns {Hallazgo[]}
 */
export function detectarSqlFueraDeMigraciones(archivos, carpetaMigraciones = "prisma/migrations") {
  const porCarpeta = new Map()
  for (const a of archivos.map(rutaRelativa).filter(Boolean)) {
    if (a.startsWith(`${carpetaMigraciones}/`) || a.includes(`/${carpetaMigraciones}/`)) continue
    const carpeta = a.includes("/") ? a.slice(0, a.lastIndexOf("/")) : "."
    porCarpeta.set(carpeta, (porCarpeta.get(carpeta) ?? 0) + 1)
  }
  return [...porCarpeta.entries()].map(([carpeta, n]) => ({
    herramienta: "Semgrep",
    categoria: CATEGORIAS.MIGRACIONES,
    severidad: "Media",
    titulo: recortar(`${n} ${n === 1 ? "script SQL" : "scripts SQL"} fuera de las migraciones en ${carpeta}`, 150),
    descripcion: "Los cambios de esquema aplicados a mano no quedan versionados. Usa migraciones (prisma migrate) para que cada cambio se revise y se aplique igual en todos los ambientes.",
    rutaArchivo: carpeta === "." ? null : carpeta,
    linea: null,
    regla: "sql-fuera-de-migraciones",
    huella: huella("sql-fuera-de-migraciones", carpeta),
  }))
}

/**
 * Reporte JSON de Vitest (`--reporter=json`) y, si existe, el resumen de cobertura
 * (`coverage/coverage-summary.json`).
 */
export function parsearPruebas(vitestJson, coberturaJson) {
  const fallidas = Number(vitestJson?.numFailedTests)
  const total = Number(vitestJson?.numTotalTests)
  const pct = Number(coberturaJson?.total?.lines?.pct)
  return {
    pruebasFallidas: Number.isInteger(fallidas) && fallidas >= 0 ? fallidas : 0,
    pruebasTotales: Number.isInteger(total) && total >= 0 ? total : null,
    cobertura: Number.isFinite(pct) && pct >= 0 && pct <= 100 ? Math.round(pct * 100) / 100 : null,
  }
}

/** Quita duplicados exactos (misma huella) que algunas herramientas reportan dos veces. */
export function unicos(hallazgos) {
  const vistos = new Set()
  return hallazgos.filter((h) => (vistos.has(h.huella) ? false : (vistos.add(h.huella), true)))
}
