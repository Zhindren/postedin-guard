import Link from "next/link"
import { notFound } from "next/navigation"
import { Estado, Severidad } from "@/components/badges"
import { FormAccion } from "@/components/form-accion"
import { esLider, requireUser } from "@/lib/auth/guards"
import { prisma } from "@/lib/db"
import { fmtFecha, fmtFechaHora, iniciales, shaCorto } from "@/lib/formato"
import { ESTADOS, ETIQUETA_ESTADO, estaVencido, fechaLimite, puedeGestionar } from "@/lib/hallazgos"
import { idValido } from "@/lib/validacion"
import { asignarAction, cambiarEstadoAction, comentarAction } from "../actions"

export const metadata = { title: "Hallazgo" }

export default async function HallazgoPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser()
  const id = idValido((await params).id)
  if (!id) notFound()
  const h = await prisma.hallazgo.findUnique({
    where: { id },
    include: {
      severidad: true,
      categoria: true,
      herramienta: true,
      asignado: { select: { id: true, nombre: true, apellido: true } },
      escaneo: { include: { repositorio: { select: { id: true, nombre: true, urlGithub: true } } } },
      comentarios: { orderBy: { fechaComentario: "asc" }, include: { usuario: { select: { nombre: true, apellido: true } } } },
    },
  })
  if (!h) notFound()
  const lider = esLider(actor)
  const gestiona = puedeGestionar(actor, h)
  const personas = lider
    ? await prisma.usuario.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, apellido: true } })
    : []
  const historial = await prisma.bitacoraAuditoria.findMany({
    where: { entidad: "hallazgo", entidadId: h.id, accion: { in: ["HALLAZGO_ESTADO", "HALLAZGO_ASIGNADO"] } },
    orderBy: { fechaEvento: "asc" },
    include: { usuario: { select: { nombre: true, apellido: true } } },
  })
  const vencido = estaVencido(h, h.severidad.plazoDias)
  const repo = h.escaneo.repositorio
  const enlaceCodigo = h.rutaArchivo
    ? `${repo.urlGithub}/blob/${h.escaneo.commitSha}/${h.rutaArchivo.split("/").map(encodeURIComponent).join("/")}${h.linea ? `#L${h.linea}` : ""}`
    : null

  return (
    <>
      <div className="page-head">
        <div>
          <div className="breadcrumb"><Link href="/hallazgos">Hallazgos</Link> / H-{String(h.id).padStart(4, "0")}</div>
          <h1>{h.titulo}</h1>
          <p className="row">
            <Severidad nombre={h.severidad.nombre} /> <Estado estado={h.estado} />
            <span>
              Detectado por {h.herramienta.nombre}{h.escaneo.numeroPr ? ` en el PR #${h.escaneo.numeroPr}` : ""} · plazo {h.severidad.plazoDias} días
              (vence el {fmtFecha(fechaLimite(h.fechaDeteccion, h.severidad.plazoDias))}){vencido ? " · " : ""}
              {vencido && <strong className="error-msg">vencido</strong>}
            </span>
          </p>
        </div>
      </div>
      <div className="grid grid-2">
        <div className="stack">
          <section className="card stack">
            <h2>Evidencia</h2>
            <dl className="meta">
              <dt>Repositorio</dt><dd>{repo.nombre} (rama {h.escaneo.ramaOrigen})</dd>
              <dt>Archivo</dt>
              <dd className="mono">
                {enlaceCodigo ? <a href={enlaceCodigo} target="_blank" rel="noopener noreferrer">{h.rutaArchivo}{h.linea ? ` · línea ${h.linea}` : ""}</a> : "—"}
              </dd>
              <dt>Regla</dt><dd className="mono">{h.regla ?? "—"}</dd>
              <dt>Categoría</dt><dd>{h.categoria.nombre}{h.categoria.referenciaOwasp ? ` (OWASP ${h.categoria.referenciaOwasp})` : ""}</dd>
              <dt>Commit</dt><dd className="mono">{shaCorto(h.escaneo.commitSha)} · <Link href={`/escaneos/${h.escaneoId}`}>ver escaneo</Link></dd>
              <dt>Huella</dt><dd className="mono">{h.huella.slice(0, 4)}…{h.huella.slice(-4)}</dd>
            </dl>
            {h.descripcion && <p style={{ margin: 0 }}>{h.descripcion}</p>}
            <div className="alert info">Postedin Guard nunca almacena el código ni el valor de un secreto: solo su ubicación y una huella para evitar duplicados.</div>
          </section>
          <section className="card">
            <h2>Comentarios</h2>
            {h.comentarios.length === 0 && <p className="muted">Todavía no hay comentarios.</p>}
            {h.comentarios.map((c) => (
              <div className="comment" key={c.id}>
                <div className="avatar" aria-hidden>{iniciales(`${c.usuario.nombre} ${c.usuario.apellido}`)}</div>
                <div>
                  <strong>{c.usuario.nombre} {c.usuario.apellido}</strong> <small>· {fmtFechaHora(c.fechaComentario)}</small>
                  <p style={{ whiteSpace: "pre-wrap" }}>{c.contenido}</p>
                </div>
              </div>
            ))}
            <FormAccion action={comentarAction.bind(null, h.id)} boton="Comentar" limpiarAlGuardar>
              <label htmlFor="contenido" className="sr-only">Comentario</label>
              <textarea id="contenido" name="contenido" className="input" placeholder="Escribe un comentario…" maxLength={2000} required />
            </FormAccion>
          </section>
        </div>
        <div className="stack">
          <section className="card stack">
            <h2>Gestión del hallazgo</h2>
            {lider && (
              <FormAccion action={asignarAction.bind(null, h.id)} boton="Guardar responsable" variante="light">
                <div className="field">
                  <label htmlFor="asignadoId">Responsable</label>
                  <select id="asignadoId" name="asignadoId" className="input" defaultValue={h.asignado?.id ?? ""}>
                    <option value="">Sin responsable</option>
                    {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
                  </select>
                </div>
              </FormAccion>
            )}
            {!lider && (
              <dl className="meta"><dt>Responsable</dt><dd>{h.asignado ? `${h.asignado.nombre} ${h.asignado.apellido}` : "Sin asignar"}</dd></dl>
            )}
            {gestiona ? (
              <FormAccion action={cambiarEstadoAction.bind(null, h.id)} boton="Cambiar estado">
                <div className="field">
                  <label htmlFor="estado">Estado</label>
                  <select id="estado" name="estado" className="input" defaultValue={h.estado}>
                    {ESTADOS.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="justificacion">Justificación</label>
                  <textarea id="justificacion" name="justificacion" className="input" maxLength={1000}
                    placeholder="Obligatoria para falso positivo: explica por qué no aplica." />
                </div>
              </FormAccion>
            ) : (
              <p className="muted" style={{ margin: 0 }}>Solo la persona responsable o el Líder Técnico pueden cambiar el estado.</p>
            )}
          </section>
          <section className="card">
            <h2>Historial</h2>
            <dl className="meta">
              <dt>{fmtFechaHora(h.fechaDeteccion)}</dt><dd>Detectado por {h.herramienta.nombre}</dd>
              {historial.map((e) => (
                <div key={String(e.id)} style={{ display: "contents" }}>
                  <dt>{fmtFechaHora(e.fechaEvento)}</dt>
                  <dd>{e.accion === "HALLAZGO_ESTADO" ? `Estado: ${e.detalle}` : "Cambio de responsable"}{e.usuario ? ` · ${e.usuario.nombre} ${e.usuario.apellido}` : ""}</dd>
                </div>
              ))}
              {h.fechaCierre && <><dt>{fmtFechaHora(h.fechaCierre)}</dt><dd>Cerrado</dd></>}
            </dl>
          </section>
        </div>
      </div>
    </>
  )
}
