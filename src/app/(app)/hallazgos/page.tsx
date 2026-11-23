import Link from "next/link"
import { Estado, Paginacion, Severidad } from "@/components/badges"
import { esLider, requireUser } from "@/lib/auth/guards"
import { prisma } from "@/lib/db"
import { fmtFecha } from "@/lib/formato"
import { ESTADOS, ETIQUETA_ESTADO, estaVencido, fechaLimite, leerFiltros, listarHallazgos } from "@/lib/hallazgos"

export const metadata = { title: "Hallazgos" }

type SP = Record<string, string | string[] | undefined>

export default async function HallazgosPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireUser()
  const sp = await searchParams
  // El Desarrollador entra viendo lo que tiene asignado; el Líder, todo lo pendiente.
  const sinFiltros = Object.keys(sp).length === 0
  const f = leerFiltros(sinFiltros ? { estado: "PENDIENTES", ...(esLider(actor) ? {} : { responsable: "yo" }) } : sp)
  const [{ total, filas, paginas }, repos, severidades, personas] = await Promise.all([
    listarHallazgos(f, actor),
    prisma.repositorio.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    prisma.severidad.findMany({ orderBy: { nivel: "desc" } }),
    prisma.usuario.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, apellido: true } }),
  ])
  const params = new URLSearchParams()
  if (f.repo) params.set("repo", String(f.repo))
  if (f.severidad) params.set("severidad", String(f.severidad))
  if (f.estado) params.set("estado", f.estado)
  if (f.responsable) params.set("responsable", String(f.responsable))
  if (f.q) params.set("q", f.q)
  const href = (p: number) => `/hallazgos?${new URLSearchParams([...params, ["pagina", String(p)]])}`
  const exportar = `/api/hallazgos/export?${params}`

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hallazgos</h1>
          <p>Problemas detectados en los repositorios, con responsable y plazo según su severidad.</p>
        </div>
        {esLider(actor) && <a className="btn btn-light" href={exportar}>Exportar CSV</a>}
      </div>
      <form className="card filters" method="get" role="search" aria-label="Filtrar hallazgos">
        <label className="sr-only" htmlFor="f-q">Texto</label>
        <input id="f-q" name="q" className="input" placeholder="Título, archivo o regla" defaultValue={f.q} maxLength={100} />
        <label className="sr-only" htmlFor="f-repo">Repositorio</label>
        <select id="f-repo" name="repo" className="input" defaultValue={f.repo ?? ""}>
          <option value="">Todos los repositorios</option>
          {repos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-sev">Severidad</label>
        <select id="f-sev" name="severidad" className="input" defaultValue={f.severidad ?? ""}>
          <option value="">Todas las severidades</option>
          {severidades.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-estado">Estado</label>
        <select id="f-estado" name="estado" className="input" defaultValue={f.estado ?? ""}>
          <option value="">Todos los estados</option>
          <option value="PENDIENTES">Pendientes (abiertos y en progreso)</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-resp">Responsable</label>
        <select id="f-resp" name="responsable" className="input" defaultValue={f.responsable ?? ""}>
          <option value="">Cualquier responsable</option>
          <option value="yo">Asignados a mí</option>
          <option value="sin">Sin responsable</option>
          {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
        </select>
        <button type="submit" className="btn btn-primary">Filtrar</button>
        <Link href="/hallazgos?estado=" className="btn btn-light">Limpiar</Link>
      </form>
      <section className="card">
        {filas.length === 0 ? <p className="empty">No hay hallazgos con estos filtros.</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Severidad</th><th>Hallazgo</th><th className="hide-sm">Responsable</th><th>Estado</th><th className="hide-sm">Plazo</th></tr>
              </thead>
              <tbody>
                {filas.map((h) => {
                  const vencido = estaVencido(h, h.severidad.plazoDias)
                  return (
                    <tr key={h.id}>
                      <td><Severidad nombre={h.severidad.nombre} /></td>
                      <td>
                        <Link href={`/hallazgos/${h.id}`}>{h.titulo}</Link>
                        <span className="sub">
                          {h.escaneo.repositorio.nombre}{h.rutaArchivo ? ` · ${h.rutaArchivo}${h.linea ? `:${h.linea}` : ""}` : ""} · {h.herramienta.nombre}
                        </span>
                      </td>
                      <td className="hide-sm">{h.asignado ? `${h.asignado.nombre} ${h.asignado.apellido}` : <span className="muted">Sin asignar</span>}</td>
                      <td><Estado estado={h.estado} /></td>
                      <td className="hide-sm">
                        <span className={vencido ? "error-msg" : undefined}>{fmtFecha(fechaLimite(h.fechaDeteccion, h.severidad.plazoDias))}</span>
                        {vencido && <span className="sub error-msg">Vencido</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <Paginacion pagina={f.pagina} paginas={paginas} total={total} href={href} />
      </section>
    </>
  )
}
