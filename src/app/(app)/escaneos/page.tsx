import Link from "next/link"
import { Gate, Paginacion } from "@/components/badges"
import { requireUser } from "@/lib/auth/guards"
import { prisma } from "@/lib/db"
import { fmtFechaHora, fmtPorcentaje, shaCorto } from "@/lib/formato"
import { idValido } from "@/lib/validacion"
import type { Prisma } from "@/generated/prisma/client"

export const metadata = { title: "Escaneos" }

const POR_PAGINA = 25
const RESULTADOS = ["APROBADO", "BLOQUEADO", "ERROR"] as const

export default async function EscaneosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser()
  const sp = await searchParams
  const repo = idValido(sp.repo)
  const resultado = RESULTADOS.find((r) => r === sp.resultado) ?? null
  const pagina = idValido(sp.pagina) ?? 1
  const where: Prisma.EscaneoWhereInput = { ...(repo ? { repositorioId: repo } : {}), ...(resultado ? { resultado } : {}) }
  const [total, escaneos, repos] = await Promise.all([
    prisma.escaneo.count({ where }),
    prisma.escaneo.findMany({
      where,
      orderBy: { fechaEjecucion: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: { repositorio: { select: { nombre: true } }, _count: { select: { hallazgos: true } } },
    }),
    prisma.repositorio.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ])
  const base = new URLSearchParams()
  if (repo) base.set("repo", String(repo))
  if (resultado) base.set("resultado", resultado)
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Escaneos de pull requests</h1>
          <p>Cada análisis que GitHub Actions envió a Postedin Guard y el resultado del quality gate.</p>
        </div>
      </div>
      <form className="card filters" method="get" aria-label="Filtrar escaneos">
        <label className="sr-only" htmlFor="f-repo">Repositorio</label>
        <select id="f-repo" name="repo" className="input" defaultValue={repo ?? ""}>
          <option value="">Todos los repositorios</option>
          {repos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-res">Resultado</label>
        <select id="f-res" name="resultado" className="input" defaultValue={resultado ?? ""}>
          <option value="">Todos los resultados</option>
          {RESULTADOS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button className="btn btn-primary" type="submit">Filtrar</button>
      </form>
      <section className="card">
        {escaneos.length === 0 ? <p className="empty">Todavía no hay escaneos. Llegan cuando GitHub Actions analiza un pull request.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>PR / repositorio</th><th className="hide-sm">Autor</th><th>Quality gate</th><th className="hide-sm">Hallazgos</th><th className="hide-sm">Cobertura</th><th>Fecha</th></tr></thead>
              <tbody>
                {escaneos.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/escaneos/${e.id}`}>{e.numeroPr ? `#${e.numeroPr}` : e.ramaOrigen}</Link>
                      <span className="sub">{e.repositorio.nombre} · <span className="mono">{shaCorto(e.commitSha)}</span></span>
                    </td>
                    <td className="hide-sm">{e.autorGithub}</td>
                    <td><Gate resultado={e.resultado} /></td>
                    <td className="hide-sm">{e.totalHallazgos}<span className="sub">{e._count.hallazgos} nuevos</span></td>
                    <td className="hide-sm">{fmtPorcentaje(e.coberturaPruebas === null ? null : Number(e.coberturaPruebas), 1)}</td>
                    <td>{fmtFechaHora(e.fechaEjecucion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacion pagina={pagina} paginas={Math.max(1, Math.ceil(total / POR_PAGINA))} total={total}
          href={(p) => `/escaneos?${new URLSearchParams([...base, ["pagina", String(p)]])}`} />
      </section>
    </>
  )
}
