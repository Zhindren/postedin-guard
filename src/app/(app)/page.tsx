import Link from "next/link"
import { Gate } from "@/components/badges"
import { esLider, requireUser } from "@/lib/auth/guards"
import { indicadores } from "@/lib/dashboard"
import { fmtFechaHora, fmtPorcentaje, shaCorto } from "@/lib/formato"

export const metadata = { title: "Dashboard" }

const COLOR_NIVEL: Record<number, string> = { 4: "var(--critica)", 3: "var(--alta)", 2: "#f2c230", 1: "var(--baja)" }
const NOMBRE_NIVEL: Record<number, string> = { 4: "Crítica", 3: "Alta", 2: "Media", 1: "Baja" }

export default async function DashboardPage() {
  const actor = await requireUser()
  const lider = esLider(actor)
  const d = await indicadores(actor)
  const maxSemana = Math.max(1, ...d.semanas.map((s) => s.total))
  const maxCategoria = Math.max(1, ...d.porCategoria.map((c) => c.n))

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>{lider ? "Estado de seguridad y calidad de los repositorios del equipo." : "Tus hallazgos asignados y el estado de los análisis."}</p>
        </div>
        <Link className="btn btn-light" href="/hallazgos">Ver hallazgos</Link>
      </div>

      <div className="grid grid-4">
        <div className="card kpi critica">
          <div className="label">{lider ? "Críticos abiertos" : "Mis críticos abiertos"}</div>
          <div className="value">{d.criticos}</div>
          <div className="trend">{d.vencidos > 0 ? <span className="error-msg">{d.vencidos} pendientes vencidos</span> : "Ninguno vencido"}</div>
        </div>
        <div className="card kpi alta">
          <div className="label">{lider ? "Altos abiertos" : "Mis altos abiertos"}</div>
          <div className="value">{d.altos}</div>
          <div className="trend">{d.pendientes} pendientes en total</div>
        </div>
        <div className="card kpi okc">
          <div className="label">PR aprobados por el gate</div>
          <div className="value">{fmtPorcentaje(d.aprobacionPr)}</div>
          <div className="trend">{d.escaneosPr} PR analizados en 30 días</div>
        </div>
        <div className="card kpi info">
          <div className="label">Tiempo medio de remediación</div>
          <div className="value">{d.remediacionDias === null ? "—" : `${String(d.remediacionDias).replace(".", ",")} días`}</div>
          <div className="trend">Cobertura de pruebas: {fmtPorcentaje(d.cobertura, 1)}</div>
        </div>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <h2>Hallazgos detectados por semana y severidad</h2>
          <div className="chart" role="img" aria-label={`Hallazgos por semana: ${d.semanas.map((s) => `${s.etiqueta}: ${s.total}`).join(", ")}`}>
            {d.semanas.map((s) => (
              <div className="col" key={s.etiqueta}>
                <div className="stack" style={{ gap: 0, height: `${(s.total / maxSemana) * 100}%`, minHeight: s.total ? 4 : 0 }}>
                  {[1, 2, 3, 4].map((n) => s.porNivel[n] > 0 && (
                    <span key={n} title={`${NOMBRE_NIVEL[n]}: ${s.porNivel[n]}`}
                      style={{ display: "block", flex: s.porNivel[n], background: COLOR_NIVEL[n] }} />
                  ))}
                </div>
                <small>{s.etiqueta}</small>
              </div>
            ))}
          </div>
          <div className="legend">
            {[4, 3, 2, 1].map((n) => <span key={n}><i style={{ background: COLOR_NIVEL[n] }} />{NOMBRE_NIVEL[n]}</span>)}
          </div>
        </section>
        <section className="card">
          <h2>Pendientes por categoría</h2>
          {d.porCategoria.length === 0 ? <p className="muted">No hay hallazgos pendientes. 🎉</p> : (
            <div className="bars">
              {d.porCategoria.map((c) => (
                <div className="bar-row" key={c.nombre}>
                  <span>{c.nombre}</span>
                  <div className="bar"><span style={{ width: `${(c.n / maxCategoria) * 100}%`, background: "var(--navy-2)" }} /></div>
                  <strong>{c.n}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <div className="spread"><h2>Últimos escaneos</h2><Link href="/escaneos">Ver todos</Link></div>
        {d.ultimos.length === 0 ? <p className="muted">Todavía no llegan análisis desde GitHub Actions.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>PR / repositorio</th><th className="hide-sm">Autor</th><th>Quality gate</th><th className="hide-sm">Hallazgos</th><th>Fecha</th></tr></thead>
              <tbody>
                {d.ultimos.map((e) => (
                  <tr key={e.id}>
                    <td><Link href={`/escaneos/${e.id}`}>{e.numeroPr ? `#${e.numeroPr}` : e.ramaOrigen}</Link><span className="sub">{e.repositorio.nombre} · <span className="mono">{shaCorto(e.commitSha)}</span></span></td>
                    <td className="hide-sm">{e.autorGithub}</td>
                    <td><Gate resultado={e.resultado} /></td>
                    <td className="hide-sm">{e.totalHallazgos}</td>
                    <td>{fmtFechaHora(e.fechaEjecucion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
