import Link from "next/link"
import { notFound } from "next/navigation"
import { Estado, Gate, Severidad } from "@/components/badges"
import { requireUser } from "@/lib/auth/guards"
import { prisma } from "@/lib/db"
import { fmtFechaHora, fmtPorcentaje } from "@/lib/formato"
import { MOTIVO_CHECKLIST, exigeChecklist } from "@/lib/gate"
import { politicasDelRepositorio } from "@/lib/ingesta/procesar"
import { idValido } from "@/lib/validacion"
import { guardarChecklistAction } from "../actions"
import { ChecklistForm } from "./checklist-form"

export const metadata = { title: "Escaneo" }

export default async function EscaneoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const id = idValido((await params).id)
  if (!id) notFound()
  const e = await prisma.escaneo.findUnique({
    where: { id },
    include: {
      repositorio: { select: { id: true, nombre: true, urlGithub: true } },
      detecciones: {
        orderBy: { hallazgo: { severidad: { nivel: "desc" } } },
        include: { hallazgo: { include: { severidad: true, herramienta: { select: { nombre: true } } } } },
      },
      respuestas: { include: { usuario: { select: { nombre: true, apellido: true } } } },
    },
  })
  if (!e) notFound()
  const [items, politicas] = await Promise.all([
    prisma.itemChecklist.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    politicasDelRepositorio(e.repositorio.id),
  ])
  const respuestas = new Map(e.respuestas.map((r) => [r.itemId, r]))
  const exige = exigeChecklist(politicas)
  const pendienteChecklist = exige && items.some((i) => !respuestas.has(i.id))
  const presentes = e.detecciones.map((d) => d.hallazgo)
  const nuevos = presentes.filter((h) => h.escaneoId === e.id).length
  const ultima = e.respuestas.toSorted((a, b) => b.fechaRespuesta.getTime() - a.fechaRespuesta.getTime())[0]
  const urlPr = e.numeroPr ? `${e.repositorio.urlGithub}/pull/${e.numeroPr}` : null

  return (
    <>
      <div className="page-head">
        <div>
          <div className="breadcrumb"><Link href="/escaneos">Escaneos</Link> / {e.numeroPr ? `PR #${e.numeroPr}` : e.ramaOrigen}</div>
          <h1>{e.repositorio.nombre} · {e.numeroPr ? `PR #${e.numeroPr}` : `rama ${e.ramaOrigen}`}</h1>
          <p className="row"><Gate resultado={e.resultado} /> <span>{fmtFechaHora(e.fechaEjecucion)} · autor {e.autorGithub}</span></p>
        </div>
        <div className="row">
          {urlPr && <a className="btn btn-light" href={urlPr} target="_blank" rel="noopener noreferrer">Ver PR</a>}
          {e.urlEjecucion && <a className="btn btn-light" href={e.urlEjecucion} target="_blank" rel="noopener noreferrer">Ver ejecución</a>}
        </div>
      </div>
      {(e.motivo || pendienteChecklist) && (
        <div className={`alert ${e.resultado === "APROBADO" ? "info" : "danger"}`}>
          <strong>Motivos:</strong> {[e.motivo, pendienteChecklist ? MOTIVO_CHECKLIST : null].filter(Boolean).join(" ")}
        </div>
      )}
      <div className="grid grid-4">
        <div className="card kpi info"><div className="label">Hallazgos en el análisis</div><div className="value">{e.totalHallazgos}</div><div className="trend">{nuevos} nuevos</div></div>
        <div className="card kpi alta"><div className="label">Pruebas fallidas</div><div className="value">{e.pruebasFallidas}</div></div>
        <div className="card kpi okc"><div className="label">Cobertura</div><div className="value">{fmtPorcentaje(e.coberturaPruebas === null ? null : Number(e.coberturaPruebas), 1)}</div></div>
        <div className="card kpi critica"><div className="label">Análisis (sin checklist)</div><div className="value" style={{ fontSize: 20 }}><Gate resultado={e.resultadoAnalisis} /></div></div>
      </div>
      <div className="grid grid-2">
        <section className="card">
          <h2>Hallazgos presentes en este análisis</h2>
          {presentes.length === 0 ? <p className="muted">El análisis no encontró hallazgos.</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Severidad</th><th>Hallazgo</th><th>Estado</th></tr></thead>
                <tbody>
                  {presentes.map((h) => (
                    <tr key={h.id}>
                      <td><Severidad nombre={h.severidad.nombre} /></td>
                      <td><Link href={`/hallazgos/${h.id}`}>{h.titulo}</Link><span className="sub">{h.herramienta.nombre}{h.rutaArchivo ? ` · ${h.rutaArchivo}` : ""}{h.escaneoId === e.id ? " · nuevo" : ""}</span></td>
                      <td><Estado estado={h.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card">
          <h2>Checklist de revisión IA</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {exige ? "La política de este repositorio exige completarlo para aprobar el PR." : "Opcional para este repositorio."}
            {ultima ? ` Última respuesta: ${ultima.usuario.nombre} ${ultima.usuario.apellido}, ${fmtFechaHora(ultima.fechaRespuesta)}.` : ""}
          </p>
          <ChecklistForm
            action={guardarChecklistAction.bind(null, e.id)}
            items={items.map((i) => ({ id: i.id, pregunta: i.pregunta, respuesta: respuestas.get(i.id) ?? null }))}
          />
        </section>
      </div>
    </>
  )
}
