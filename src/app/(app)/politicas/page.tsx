import { FormAccion } from "@/components/form-accion"
import { requireLider } from "@/lib/auth/guards"
import { prisma } from "@/lib/db"
import { cambiarEstadoPoliticaAction, crearPoliticaAction, editarPoliticaAction } from "./actions"
import { CamposPolitica } from "./campos-politica"

export const metadata = { title: "Políticas" }

export default async function PoliticasPage() {
  await requireLider()
  const [politicas, severidades] = await Promise.all([
    prisma.politicaSeguridad.findMany({
      orderBy: [{ activa: "desc" }, { nombre: "asc" }],
      include: { severidadBloqueo: true, repositorios: { include: { repositorio: { select: { nombre: true } } } } },
    }),
    prisma.severidad.findMany({ orderBy: { nivel: "desc" }, select: { id: true, nombre: true } }),
  ])
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Políticas de seguridad</h1>
          <p>Reglas que decide el quality gate: qué severidad bloquea, cobertura mínima y si se exige el checklist IA.</p>
        </div>
      </div>
      <div className="grid grid-2">
        <div className="stack">
          {politicas.length === 0 && <section className="card"><p className="empty">No hay políticas.</p></section>}
          {politicas.map((p) => (
            <section className="card stack" key={p.id}>
              <div className="spread">
                <h2 style={{ margin: 0 }}>{p.nombre} {!p.activa && <span className="state inactivo">Inactiva</span>}</h2>
                <FormAccion compacto variante={p.activa ? "danger" : "light"} boton={p.activa ? "Desactivar" : "Activar"}
                  action={cambiarEstadoPoliticaAction.bind(null, p.id, !p.activa)} />
              </div>
              <p className="muted" style={{ margin: 0 }}>
                Bloquea {p.severidadBloqueo.nombre} o superior
                {p.coberturaMinima !== null ? ` · cobertura mínima ${Number(p.coberturaMinima)} %` : ""}
                {p.exigeChecklistIa ? " · exige checklist IA" : ""}
              </p>
              <div>
                {p.repositorios.length === 0
                  ? <span className="muted">Sin repositorios asignados.</span>
                  : p.repositorios.map((r) => <span className="chip" key={r.repositorioId}>{r.repositorio.nombre}</span>)}
              </div>
              <details>
                <summary className="link-btn">Editar</summary>
                <div style={{ marginTop: 12 }}>
                  <FormAccion action={editarPoliticaAction.bind(null, p.id)} boton="Guardar cambios">
                    <CamposPolitica sufijo={`-${p.id}`} severidades={severidades}
                      v={{ ...p, coberturaMinima: p.coberturaMinima === null ? null : Number(p.coberturaMinima) }} />
                  </FormAccion>
                </div>
              </details>
            </section>
          ))}
        </div>
        <section className="card">
          <h2>Nueva política</h2>
          <FormAccion action={crearPoliticaAction} boton="Crear política" limpiarAlGuardar>
            <CamposPolitica severidades={severidades} />
          </FormAccion>
        </section>
      </div>
    </>
  )
}
