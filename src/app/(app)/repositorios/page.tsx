import Link from "next/link"
import { FormAccion } from "@/components/form-accion"
import { requireLider } from "@/lib/auth/guards"
import { prisma } from "@/lib/db"
import { fmtFechaHora } from "@/lib/formato"
import { crearRepositorioAction } from "./actions"
import { CamposRepositorio } from "./campos-repositorio"

export const metadata = { title: "Repositorios" }

export default async function RepositoriosPage() {
  await requireLider()
  const [repos, personas] = await Promise.all([
    prisma.repositorio.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: {
        responsable: { select: { nombre: true, apellido: true } },
        escaneos: { orderBy: { fechaEjecucion: "desc" }, take: 1, select: { fechaEjecucion: true, resultado: true } },
      },
    }),
    prisma.usuario.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, apellido: true } }),
  ])
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Repositorios</h1>
          <p>Repositorios de GitHub que envían sus análisis a Postedin Guard.</p>
        </div>
      </div>
      <div className="grid grid-2">
        <section className="card">
          {repos.length === 0 ? <p className="empty">Todavía no hay repositorios registrados.</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Repositorio</th><th className="hide-sm">Responsable</th><th>Token</th><th className="hide-sm">Último análisis</th></tr></thead>
                <tbody>
                  {repos.map((r) => {
                    const ultimo = r.escaneos[0]
                    return (
                      <tr key={r.id}>
                        <td>
                          <Link href={`/repositorios/${r.id}`}>{r.nombre}</Link>
                          <span className="sub">{r.urlGithub.replace("https://github.com/", "")} · {r.ramaPrincipal}{r.activo ? "" : " · inactivo"}</span>
                        </td>
                        <td className="hide-sm">{r.responsable.nombre} {r.responsable.apellido}</td>
                        <td><span className={`state ${r.tokenHash ? "activo" : "inactivo"}`}>{r.tokenHash ? "Vigente" : "Sin token"}</span></td>
                        <td className="hide-sm">
                          {ultimo ? <>{fmtFechaHora(ultimo.fechaEjecucion)}<span className="sub">{ultimo.resultado}</span></> : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card">
          <h2>Registrar repositorio</h2>
          <FormAccion action={crearRepositorioAction} boton="Registrar">
            <CamposRepositorio personas={personas} />
          </FormAccion>
        </section>
      </div>
    </>
  )
}
