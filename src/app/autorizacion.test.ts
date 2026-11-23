import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Regla del repo: toda server action, route handler y página privada valida la sesión y el
// perfil en el servidor. El proxy solo redirige; no es una barrera de seguridad.

const APP = path.join(__dirname)
const GUARDS_ACCION = /\b(ctxLider|ctxUsuario|requireUser|requireLider)\(/
const GUARDS_RUTA = /\b(apiRequireUser|apiRequireLider|repositorioPorToken)\(/
const GUARDS_PAGINA = /\b(requireUser|requireLider)\(/

// Rutas públicas a propósito, con su motivo.
const PUBLICAS: Record<string, string> = {
  "(auth)/login/actions.ts": "inicio de sesión",
  "(auth)/recuperar/actions.ts": "pedir enlace de recuperación",
  "(auth)/restablecer/[token]/actions.ts": "definir clave con un enlace de un solo uso",
  "api/auth/[...nextauth]/route.ts": "endpoints propios de Auth.js",
}

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n)
    return statSync(p).isDirectory() ? archivos(p) : [p]
  })
}

const rel = (p: string) => path.relative(APP, p).replace(/\\/g, "/")
const todos = archivos(APP).filter((p) => /\.(ts|tsx)$/.test(p) && !p.endsWith(".test.ts"))

/** Cuerpo de cada función exportada (hasta la siguiente exportación). */
function funcionesExportadas(codigo: string): { nombre: string; cuerpo: string }[] {
  const re = /export\s+(?:async\s+)?function\s+(\w+)|export\s+const\s+(\w+)\s*=/g
  const marcas = [...codigo.matchAll(re)]
  return marcas.map((m, i) => ({
    nombre: m[1] ?? m[2],
    cuerpo: codigo.slice(m.index, marcas[i + 1]?.index ?? codigo.length),
  }))
}

describe("autorización en el servidor", () => {
  const acciones = todos.filter((p) => /^\s*["']use server["']/.test(readFileSync(p, "utf8")))
  const rutas = todos.filter((p) => p.endsWith("route.ts"))
  const paginas = todos.filter((p) => rel(p).startsWith("(app)/") && p.endsWith("page.tsx"))

  it("encuentra los archivos que debe revisar", () => {
    expect(acciones.length).toBeGreaterThan(5)
    expect(rutas.length).toBeGreaterThan(1)
    expect(paginas.length).toBeGreaterThan(5)
  })

  it.each(acciones.map((p) => [rel(p), p]))("server actions de %s validan sesión", (r, p) => {
    if (PUBLICAS[r]) return
    for (const f of funcionesExportadas(readFileSync(p, "utf8"))) {
      expect(GUARDS_ACCION.test(f.cuerpo), `${r}: ${f.nombre} no llama a ctxLider/ctxUsuario`).toBe(true)
    }
  })

  it.each(rutas.map((p) => [rel(p), p]))("route handlers de %s validan acceso", (r, p) => {
    if (PUBLICAS[r]) return
    for (const f of funcionesExportadas(readFileSync(p, "utf8"))) {
      expect(GUARDS_RUTA.test(f.cuerpo), `${r}: ${f.nombre} no valida acceso`).toBe(true)
    }
  })

  it.each(paginas.map((p) => [rel(p), p]))("la página %s exige sesión", (r, p) => {
    expect(GUARDS_PAGINA.test(readFileSync(p, "utf8")), `${r} no llama a requireUser/requireLider`).toBe(true)
  })

  it("las rutas públicas declaradas existen", () => {
    const relativos = new Set(todos.map(rel))
    for (const r of Object.keys(PUBLICAS)) expect(relativos.has(r), r).toBe(true)
  })
})
