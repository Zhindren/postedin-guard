import { Paginacion } from "@/components/badges"
import { requireLider } from "@/lib/auth/guards"
import { prisma } from "@/lib/db"
import { fmtFechaHora } from "@/lib/formato"
import { idValido } from "@/lib/validacion"
import type { Prisma } from "@/generated/prisma/client"

export const metadata = { title: "Bitácora" }

const POR_PAGINA = 50

function fecha(v: string | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T00:00:00-03:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export default async function BitacoraPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireLider()
  const sp = await searchParams
  const acciones = (await prisma.bitacoraAuditoria.findMany({ distinct: ["accion"], select: { accion: true }, orderBy: { accion: "asc" } })).map((a) => a.accion)
  const accion = acciones.includes(sp.accion ?? "") ? sp.accion! : null
  const usuario = sp.usuario === "sistema" ? "sistema" : idValido(sp.usuario)
  const desde = fecha(sp.desde)
  const hasta = fecha(sp.hasta)
  const pagina = idValido(sp.pagina) ?? 1

  const where: Prisma.BitacoraAuditoriaWhereInput = {
    ...(accion ? { accion } : {}),
    ...(usuario === "sistema" ? { usuarioId: null } : usuario ? { usuarioId: usuario } : {}),
    ...(desde || hasta ? { fechaEvento: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lt: new Date(hasta.getTime() + 86_400_000) } : {}) } } : {}),
  }
  const [total, eventos, personas] = await Promise.all([
    prisma.bitacoraAuditoria.count({ where }),
    prisma.bitacoraAuditoria.findMany({
      where, orderBy: { fechaEvento: "desc" }, skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA,
      include: { usuario: { select: { nombre: true, apellido: true } } },
    }),
    prisma.usuario.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true, apellido: true } }),
  ])
  const base = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "pagina" && v) as [string, string][])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bitácora de auditoría</h1>
          <p>Accesos, cambios de configuración y de hallazgos, y análisis recibidos.</p>
        </div>
      </div>
      <form className="card filters" method="get" aria-label="Filtrar bitácora">
        <label className="sr-only" htmlFor="b-acc">Acción</label>
        <select id="b-acc" name="accion" className="input" defaultValue={accion ?? ""}>
          <option value="">Todas las acciones</option>
          {acciones.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <label className="sr-only" htmlFor="b-usr">Usuario</label>
        <select id="b-usr" name="usuario" className="input" defaultValue={usuario ?? ""}>
          <option value="">Todos los usuarios</option>
          <option value="sistema">Sistema / GitHub Actions</option>
          {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
        </select>
        <label htmlFor="b-desde" className="muted">Desde</label>
        <input id="b-desde" name="desde" type="date" className="input" defaultValue={sp.desde ?? ""} />
        <label htmlFor="b-hasta" className="muted">Hasta</label>
        <input id="b-hasta" name="hasta" type="date" className="input" defaultValue={sp.hasta ?? ""} />
        <button className="btn btn-primary" type="submit">Filtrar</button>
      </form>
      <section className="card">
        {eventos.length === 0 ? <p className="empty">No hay eventos con estos filtros.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th className="hide-sm">Detalle</th><th className="hide-sm">IP</th></tr></thead>
              <tbody>
                {eventos.map((e) => (
                  <tr key={String(e.id)}>
                    <td>{fmtFechaHora(e.fechaEvento)}</td>
                    <td>{e.usuario ? `${e.usuario.nombre} ${e.usuario.apellido}` : <span className="muted">Sistema</span>}</td>
                    <td className="mono">{e.accion}<span className="sub">{e.entidad}{e.entidadId ? ` #${e.entidadId}` : ""}</span></td>
                    <td className="hide-sm">{e.detalle ?? "—"}</td>
                    <td className="hide-sm mono">{e.direccionIp ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacion pagina={pagina} paginas={Math.max(1, Math.ceil(total / POR_PAGINA))} total={total}
          href={(p) => `/bitacora?${new URLSearchParams([...base, ["pagina", String(p)]])}`} />
      </section>
    </>
  )
}
