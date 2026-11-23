// Datos de demostración: un Líder, dos Desarrolladores y dos repositorios ficticios con tres
// semanas de análisis. Todo pasa por la misma lógica de ingesta que usa la API, así que los
// resultados del quality gate, la deduplicación y los cierres automáticos son los reales.
//
//   npx tsx prisma/demo.ts
//
// Corre contra una base local o, con GUARD_DEMO=1, contra la base del despliegue de demostración.
// Es idempotente: si los análisis ya existen, solo restablece las cuentas de prueba.

import "dotenv/config"
import { createHash, randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { prisma } from "../src/lib/db"
import { ROLES } from "../src/lib/roles"
import { esquemaIngesta, type HallazgoIngesta } from "../src/lib/ingesta/esquema"
import { procesarIngesta, type RepoAutenticado } from "../src/lib/ingesta/procesar"
import { reevaluarEscaneo } from "../src/lib/escaneos"

/** Contraseña de las tres cuentas de prueba. Solo existen en entornos de demostración. */
export const DEMO_PASSWORD = "GuardDemo2026!"
/** Token del repositorio de demo, solo en una base local (en la demo publicada es aleatorio). */
export const DEMO_TOKEN_LOCAL = "pgr_demo_local_solo_para_desarrollo_0001"

const sha = (s: string) => createHash("sha256").update(s).digest("hex")
const DIA = 86_400_000

function esBaseLocal(): boolean {
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://x@invalido/x")
  return ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
}

type Ficticio = Omit<HallazgoIngesta, "huella"> & { clave: string }

const F: Record<string, Ficticio> = {
  clave: { clave: "clave", herramienta: "gitleaks", categoria: "Secreto expuesto", severidad: "Crítica", titulo: "Clave de API expuesta en el código", descripcion: "Regla generic-api-key. El valor no se guarda.", rutaArchivo: "src/config/integraciones.ts", linea: 18, regla: "generic-api-key" },
  axios: { clave: "axios", herramienta: "npm audit", categoria: "Dependencia vulnerable", severidad: "Alta", titulo: "axios: falsificación de solicitudes del lado del servidor (SSRF)", descripcion: "Versión afectada en dependencias de producción. Actualizar a la versión corregida.", rutaArchivo: "package.json", linea: null, regla: "axios" },
  ruta: { clave: "ruta", herramienta: "Semgrep", categoria: "Permisos de API", severidad: "Alta", titulo: "Route handler sin verificación de permisos", descripcion: "El endpoint responde sin llamar a una función de autorización.", rutaArchivo: "src/app/api/reportes/route.ts", linea: 12, regla: "route-sin-autorizacion" },
  html: { clave: "html", herramienta: "Semgrep", categoria: "Código inseguro", severidad: "Media", titulo: "dangerouslySetInnerHTML sin sanitizar", descripcion: "Contenido HTML insertado sin pasar por DOMPurify.", rutaArchivo: "src/components/Resumen.tsx", linea: 40, regla: "html-sin-sanitizar" },
  sql: { clave: "sql", herramienta: "Semgrep", categoria: "Migraciones", severidad: "Alta", titulo: "Archivo SQL fuera de prisma/migrations", descripcion: "Los cambios de esquema deben hacerse con una migración versionada.", rutaArchivo: "scripts/corregir-clientes.sql", linea: 1, regla: "sql-fuera-de-migraciones" },
  yaml: { clave: "yaml", herramienta: "npm audit", categoria: "Dependencia vulnerable", severidad: "Media", titulo: "js-yaml: contaminación de prototipo al combinar documentos", descripcion: "Dependencia de desarrollo.", rutaArchivo: "package.json", linea: null, regla: "js-yaml" },
  brace: { clave: "brace", herramienta: "npm audit", categoria: "Dependencia vulnerable", severidad: "Baja", titulo: "brace-expansion: expresión regular de costo excesivo (ReDoS)", descripcion: "Dependencia transitiva de desarrollo.", rutaArchivo: "package.json", linea: null, regla: "brace-expansion" },
  raw: { clave: "raw", herramienta: "Semgrep", categoria: "Código inseguro", severidad: "Crítica", titulo: "$queryRawUnsafe con datos del usuario", descripcion: "Consulta SQL construida con texto del usuario: riesgo de inyección.", rutaArchivo: "src/lib/busqueda.ts", linea: 27, regla: "query-raw-unsafe" },
  cookie: { clave: "cookie", herramienta: "Semgrep", categoria: "Gestión de sesiones", severidad: "Media", titulo: "Cookie de sesión sin atributo secure", descripcion: "La cookie puede viajar por HTTP sin cifrar.", rutaArchivo: "src/lib/sesion.ts", linea: 15, regla: "cookie-sesion-insegura" },
  prueba: { clave: "prueba", herramienta: "gitleaks", categoria: "Secreto expuesto", severidad: "Alta", titulo: "Token en archivo de pruebas", descripcion: "Regla generic-api-key. El valor no se guarda.", rutaArchivo: "tests/fixtures/config.test.ts", linea: 3, regla: "generic-api-key" },
  log: { clave: "log", herramienta: "npm audit", categoria: "Dependencia vulnerable", severidad: "Baja", titulo: "cookie: acepta caracteres fuera de rango en el nombre", descripcion: "Dependencia transitiva; sin explotación conocida en este uso.", rutaArchivo: "package.json", linea: null, regla: "cookie" },
}

function hallazgos(repo: string, claves: string[]): HallazgoIngesta[] {
  return claves.map((k) => {
    const { clave, ...h } = F[k]
    return { ...h, huella: sha(`${repo}:${clave}`) }
  })
}

type Analisis = { dias: number; pr: number | null; rama: string; autor: string; cobertura: number; fallidas?: number; claves: string[] }

async function analizar(repo: RepoAutenticado, nombre: string, a: Analisis) {
  const payload = esquemaIngesta.parse({
    commitSha: sha(`${nombre}:${a.dias}:${a.rama}`).slice(0, 40),
    ramaOrigen: a.rama,
    numeroPr: a.pr,
    autorGithub: a.autor,
    herramientasEjecutadas: ["gitleaks", "npm audit", "Semgrep", "Vitest"],
    pruebasFallidas: a.fallidas ?? 0,
    pruebasTotales: 142,
    cobertura: a.cobertura,
    hallazgos: hallazgos(nombre, a.claves),
  })
  return procesarIngesta(repo, payload, null, new Date(Date.now() - a.dias * DIA))
}

async function hallazgo(repo: string, clave: string) {
  return prisma.hallazgo.findFirstOrThrow({ where: { huella: sha(`${repo}:${clave}`) } })
}

async function main() {
  if (!esBaseLocal() && process.env.GUARD_DEMO !== "1") {
    console.error("demo: fuera de localhost solo corre con GUARD_DEMO=1 (despliegue de demostración).")
    process.exit(1)
  }
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12)
  const rol = async (n: string) => (await prisma.rol.findUniqueOrThrow({ where: { nombre: n } })).id
  const personas = [
    { email: "lider@demo.test", nombre: "Lía", apellido: "Demo", usuarioGithub: "lia-demo", rolId: await rol(ROLES.LIDER) },
    { email: "dev1@demo.test", nombre: "Diego", apellido: "Demo", usuarioGithub: "diego-demo", rolId: await rol(ROLES.DESARROLLADOR) },
    { email: "dev2@demo.test", nombre: "Vale", apellido: "Demo", usuarioGithub: "vale-demo", rolId: await rol(ROLES.DESARROLLADOR) },
  ]
  // Cada ejecución restablece la clave y el estado de las cuentas de prueba.
  for (const p of personas) {
    await prisma.usuario.upsert({
      where: { email: p.email },
      update: { passwordHash: hash, activo: true, rolId: p.rolId },
      create: { ...p, passwordHash: hash },
    })
  }
  const [lider, dev1, dev2] = await Promise.all(personas.map((p) => prisma.usuario.findUniqueOrThrow({ where: { email: p.email } })))

  const urlPortal = "https://github.com/demo-guard/portal-demo"
  if (await prisma.repositorio.findUnique({ where: { urlGithub: urlPortal } })) {
    console.log("demo: los datos ya existen; cuentas de prueba restablecidas")
    return
  }

  const token = esBaseLocal() ? DEMO_TOKEN_LOCAL : `pgr_${randomBytes(24).toString("base64url")}`
  const portal = await prisma.repositorio.create({
    data: { nombre: "portal-demo", urlGithub: urlPortal, responsableId: lider.id, tokenHash: sha(token) },
  })
  const api = await prisma.repositorio.create({
    data: { nombre: "api-demo", urlGithub: "https://github.com/demo-guard/api-demo", responsableId: dev1.id, tokenHash: sha(`pgr_${randomBytes(24).toString("base64url")}`) },
  })
  const base = await prisma.politicaSeguridad.findUniqueOrThrow({ where: { nombre: "Base Postedin" } })
  const critica = await prisma.severidad.findUniqueOrThrow({ where: { nombre: "Crítica" } })
  const soloCriticos = await prisma.politicaSeguridad.upsert({
    where: { nombre: "Solo críticos y cobertura" },
    update: {},
    create: { nombre: "Solo críticos y cobertura", descripcion: "Bloquea hallazgos Críticos y cobertura bajo 70 %.", severidadBloqueoId: critica.id, coberturaMinima: 70, exigeChecklistIa: false },
  })
  await prisma.repositorioPolitica.createMany({
    data: [{ repositorioId: portal.id, politicaId: base.id }, { repositorioId: api.id, politicaId: soloCriticos.id }],
  })

  const rp = { id: portal.id, ramaPrincipal: "main" }
  const ra = { id: api.id, ramaPrincipal: "main" }
  const P = "portal-demo"

  await analizar(rp, P, { dias: 20, pr: 12, rama: "feature/integraciones", autor: "diego-demo", cobertura: 71.2, claves: ["clave", "axios", "brace"] })
  await analizar(rp, P, { dias: 18, pr: null, rama: "main", autor: "lia-demo", cobertura: 71.8, claves: ["clave", "axios", "brace", "yaml"] })
  await analizar(rp, P, { dias: 15, pr: 15, rama: "feature/reportes", autor: "vale-demo", cobertura: 72.4, claves: ["clave", "axios", "ruta", "yaml", "brace"] })
  await analizar(rp, P, { dias: 12, pr: 16, rama: "feature/busqueda", autor: "diego-demo", cobertura: 69.5, fallidas: 2, claves: ["clave", "axios", "ruta", "yaml", "brace", "raw"] })

  // El Líder reparte el trabajo y descarta una falsa alarma.
  const fp = await analizar(rp, P, { dias: 9, pr: null, rama: "main", autor: "lia-demo", cobertura: 73.1, claves: ["axios", "ruta", "yaml", "brace", "raw", "prueba"] })
  const asignaciones: [string, number, "ABIERTO" | "EN_PROGRESO"][] = [["axios", dev1.id, "EN_PROGRESO"], ["raw", dev1.id, "EN_PROGRESO"], ["ruta", dev2.id, "EN_PROGRESO"], ["yaml", dev1.id, "ABIERTO"]]
  for (const [k, uid, estado] of asignaciones) {
    await prisma.hallazgo.update({ where: { id: (await hallazgo(P, k)).id }, data: { asignadoId: uid, estado } })
  }
  const hPrueba = await hallazgo(P, "prueba")
  await prisma.hallazgo.update({ where: { id: hPrueba.id }, data: { estado: "FALSO_POSITIVO", fechaCierre: new Date(Date.now() - 8 * DIA) } })
  await prisma.comentarioHallazgo.create({
    data: { hallazgoId: hPrueba.id, usuarioId: lider.id, contenido: "Falso positivo: es un valor ficticio de un archivo de pruebas, no una credencial real.", fechaComentario: new Date(Date.now() - 8 * DIA) },
  })
  await prisma.comentarioHallazgo.create({
    data: { hallazgoId: (await hallazgo(P, "raw")).id, usuarioId: dev1.id, contenido: "Lo cambio por una consulta parametrizada con Prisma.", fechaComentario: new Date(Date.now() - 8 * DIA) },
  })
  console.log(`demo: escaneo ${fp.escaneoId} de main registrado`)

  const s6 = await analizar(rp, P, { dias: 6, pr: 18, rama: "fix/seguridad", autor: "diego-demo", cobertura: 74.6, claves: ["ruta", "yaml", "brace", "prueba"] })
  await analizar(rp, P, { dias: 3, pr: null, rama: "main", autor: "lia-demo", cobertura: 75.3, claves: ["yaml", "brace", "prueba", "cookie", "html"] })
  const s8 = await analizar(rp, P, { dias: 1, pr: 21, rama: "feature/dashboard", autor: "vale-demo", cobertura: 76.0, claves: ["yaml", "brace", "prueba", "cookie", "html"] })
  await analizar(rp, P, { dias: 0, pr: 22, rama: "feature/exportar", autor: "diego-demo", cobertura: 75.8, claves: ["yaml", "brace", "prueba", "cookie", "html", "sql", "log"] })

  for (const [k, uid] of [["cookie", dev2.id], ["html", dev1.id], ["sql", dev2.id]] as const) {
    await prisma.hallazgo.update({ where: { id: (await hallazgo(P, k)).id }, data: { asignadoId: uid } })
  }
  await prisma.comentarioHallazgo.create({
    data: { hallazgoId: (await hallazgo(P, "sql")).id, usuarioId: lider.id, contenido: "Por favor pásalo a una migración de Prisma antes de integrar el PR." },
  })

  // Checklist IA: uno con observación y otro completo que destraba el PR 21.
  const items = await prisma.itemChecklist.findMany({ where: { activo: true }, orderBy: { orden: "asc" } })
  await prisma.respuestaChecklist.createMany({
    data: items.map((i, n) => ({ escaneoId: s6.escaneoId, itemId: i.id, usuarioId: dev1.id, cumple: n !== 2, observacion: n === 2 ? "Faltan pruebas del caso sin permisos." : null })),
  })
  await prisma.respuestaChecklist.createMany({
    data: items.map((i) => ({ escaneoId: s8.escaneoId, itemId: i.id, usuarioId: dev2.id, cumple: true })),
  })
  await reevaluarEscaneo(s6.escaneoId)
  await reevaluarEscaneo(s8.escaneoId)

  const A = "api-demo"
  await analizar(ra, A, { dias: 14, pr: 3, rama: "feature/clientes", autor: "diego-demo", cobertura: 81.0, claves: ["brace"] })
  await analizar(ra, A, { dias: 7, pr: 4, rama: "feature/exportacion", autor: "vale-demo", cobertura: 64.2, claves: ["brace", "log"] })
  await analizar(ra, A, { dias: 2, pr: 5, rama: "test/exportacion", autor: "vale-demo", cobertura: 78.9, claves: ["brace", "log"] })

  console.log(`demo: 3 cuentas @demo.test, repositorios ${portal.nombre} y ${api.nombre} con ${await prisma.escaneo.count()} análisis`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
