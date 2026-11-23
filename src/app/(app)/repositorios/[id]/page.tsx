import Link from "next/link"
import { notFound } from "next/navigation"
import { Gate } from "@/components/badges"
import { FormAccion } from "@/components/form-accion"
import { requireLider } from "@/lib/auth/guards"
import { prisma } from "@/lib/db"
import { fmtFechaHora, shaCorto } from "@/lib/formato"
import { asignarPoliticasAction } from "../../politicas/actions"
import { idValido } from "@/lib/validacion"
import {
  cambiarEstadoRepositorioAction, editarRepositorioAction, emitirTokenAction, revocarTokenAction,
} from "../actions"
import { CamposRepositorio } from "../campos-repositorio"
import { TokenPanel } from "./token-panel"

export const metadata = { title: "Repositorio" }

export default async function RepositorioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireLider()
  const id = idValido((await params).id)
  if (!id) notFound()
  const [repo, personas, politicas] = await Promise.all([
    prisma.repositorio.findUnique({
      where: { id },
      include: {
        politicas: { select: { politicaId: true } },
        escaneos: { orderBy: { fechaEjecucion: "desc" }, take: 8 },
      },
    }),
    prisma.usuario.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, apellido: true } }),
    prisma.politicaSeguridad.findMany({ orderBy: { nombre: "asc" }, include: { severidadBloqueo: { select: { nombre: true } } } }),
  ])
  if (!repo) notFound()
  return (
    <>
      <div className="page-head">
        <div>
          <div className="breadcrumb"><Link href="/repositorios">Repositorios</Link> / {repo.nombre}</div>
          <h1>{repo.nombre}</h1>
          <p>
            <a href={repo.urlGithub} target="_blank" rel="noopener noreferrer">{repo.urlGithub}</a>
            {" · "}registrado el {fmtFechaHora(repo.fechaRegistro)}
          </p>
        </div>
        <FormAccion compacto variante={repo.activo ? "danger" : "light"} boton={repo.activo ? "Desactivar" : "Activar"}
          confirmar={repo.activo ? "Se revocará su token y dejará de recibir análisis. ¿Continuar?" : undefined}
          action={cambiarEstadoRepositorioAction.bind(null, repo.id, !repo.activo)} />
      </div>
      {!repo.activo && <div className="alert warn">Repositorio inactivo: no recibe análisis.</div>}
      <div className="grid grid-2-even">
        <section className="card">
          <h2>Datos</h2>
          <FormAccion action={editarRepositorioAction.bind(null, repo.id)} boton="Guardar cambios">
            <CamposRepositorio v={repo} personas={personas} />
          </FormAccion>
        </section>
        <section className="card">
          <h2>Token de integración</h2>
          <TokenPanel tieneToken={!!repo.tokenHash} activo={repo.activo}
            emitir={emitirTokenAction.bind(null, repo.id)} revocar={revocarTokenAction.bind(null, repo.id)} />
        </section>
      </div>
      <div className="grid grid-2-even">
        <section className="card">
          <h2>Políticas asignadas</h2>
          {politicas.length === 0 ? <p className="muted">Primero crea una política en la sección Políticas.</p> : (
            <FormAccion action={asignarPoliticasAction.bind(null, repo.id)} boton="Guardar políticas">
              {politicas.map((p) => (
                <label className="check" key={p.id}>
                  <input type="checkbox" name="politica" value={p.id} defaultChecked={repo.politicas.some((rp) => rp.politicaId === p.id)} />
                  <span>
                    <strong>{p.nombre}</strong>{!p.activa && " (inactiva)"}
                    <span className="sub">Bloquea {p.severidadBloqueo.nombre} o superior{p.exigeChecklistIa ? " · exige checklist IA" : ""}</span>
                  </span>
                </label>
              ))}
            </FormAccion>
          )}
        </section>
        <section className="card">
          <h2>Últimos escaneos</h2>
          {repo.escaneos.length === 0 ? <p className="muted">Aún no llegan análisis de este repositorio.</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>PR</th><th>Resultado</th><th>Fecha</th></tr></thead>
                <tbody>
                  {repo.escaneos.map((e) => (
                    <tr key={e.id}>
                      <td><Link href={`/escaneos/${e.id}`}>{e.numeroPr ? `#${e.numeroPr}` : e.ramaOrigen}</Link><span className="sub mono">{shaCorto(e.commitSha)}</span></td>
                      <td><Gate resultado={e.resultado} /></td>
                      <td>{fmtFechaHora(e.fechaEjecucion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
