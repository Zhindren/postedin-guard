import { ipDesdeHeaders, registrarEvento } from "@/lib/audit"
import { apiRequireLider } from "@/lib/auth/guards"
import { aCsv } from "@/lib/csv"
import { prisma } from "@/lib/db"
import { ETIQUETA_ESTADO, fechaLimite, leerFiltros, whereHallazgos } from "@/lib/hallazgos"

const LOG = "[hallazgos/export]"
const MAXIMO = 5000

/** Exporta a CSV la lista de hallazgos con los mismos filtros de la pantalla. */
export async function GET(req: Request): Promise<Response> {
  const { sesion, respuesta } = await apiRequireLider()
  if (respuesta) return respuesta
  const sp = Object.fromEntries(new URL(req.url).searchParams)
  const f = leerFiltros(sp)
  const filas = await prisma.hallazgo.findMany({
    where: whereHallazgos(f, sesion),
    orderBy: [{ severidad: { nivel: "desc" } }, { fechaDeteccion: "desc" }],
    take: MAXIMO,
    include: {
      severidad: true,
      categoria: { select: { nombre: true } },
      herramienta: { select: { nombre: true } },
      asignado: { select: { nombre: true, apellido: true } },
      escaneo: { select: { numeroPr: true, commitSha: true, repositorio: { select: { nombre: true } } } },
    },
  })
  const csv = aCsv(filas, [
    { titulo: "ID", valor: (h) => `H-${String(h.id).padStart(4, "0")}` },
    { titulo: "Repositorio", valor: (h) => h.escaneo.repositorio.nombre },
    { titulo: "Severidad", valor: (h) => h.severidad.nombre },
    { titulo: "Categoría", valor: (h) => h.categoria.nombre },
    { titulo: "Herramienta", valor: (h) => h.herramienta.nombre },
    { titulo: "Título", valor: (h) => h.titulo },
    { titulo: "Archivo", valor: (h) => h.rutaArchivo },
    { titulo: "Línea", valor: (h) => h.linea },
    { titulo: "Regla", valor: (h) => h.regla },
    { titulo: "Estado", valor: (h) => ETIQUETA_ESTADO[h.estado] },
    { titulo: "Responsable", valor: (h) => (h.asignado ? `${h.asignado.nombre} ${h.asignado.apellido}` : "") },
    { titulo: "PR", valor: (h) => h.escaneo.numeroPr },
    { titulo: "Detectado", valor: (h) => h.fechaDeteccion.toISOString().slice(0, 10) },
    { titulo: "Fecha límite", valor: (h) => fechaLimite(h.fechaDeteccion, h.severidad.plazoDias).toISOString().slice(0, 10) },
    { titulo: "Cerrado", valor: (h) => h.fechaCierre?.toISOString().slice(0, 10) ?? "" },
  ])
  await registrarEvento({
    usuarioId: sesion.id, accion: "EXPORTACION_CSV", entidad: "hallazgo", detalle: `${filas.length} filas`, ip: ipDesdeHeaders(req.headers),
  })
  console.info(`${LOG} usuario=${sesion.id} filas=${filas.length}`)
  const fecha = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hallazgos-${fecha}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
