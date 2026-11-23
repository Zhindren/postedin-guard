import { CLASE_ESTADO, ETIQUETA_ESTADO } from "@/lib/hallazgos"
import type { EstadoHallazgo, ResultadoGate } from "@/generated/prisma/client"

const CLASE_SEVERIDAD: Record<string, string> = { "Crítica": "critica", Alta: "alta", Media: "media", Baja: "baja" }

export function Severidad({ nombre }: { nombre: string }) {
  return <span className={`badge ${CLASE_SEVERIDAD[nombre] ?? "baja"}`}>{nombre}</span>
}

export function Estado({ estado }: { estado: EstadoHallazgo }) {
  return <span className={`state ${CLASE_ESTADO[estado]}`}>{ETIQUETA_ESTADO[estado]}</span>
}

export function Gate({ resultado }: { resultado: ResultadoGate }) {
  const clase = resultado === "APROBADO" ? "ok" : resultado === "BLOQUEADO" ? "block" : "err"
  return <span className={`gate ${clase}`}>{resultado}</span>
}

export function Paginacion({ pagina, paginas, total, href }: { pagina: number; paginas: number; total: number; href: (p: number) => string }) {
  if (paginas <= 1) return <div className="pagination">{total} {total === 1 ? "resultado" : "resultados"}</div>
  return (
    <nav className="pagination" aria-label="Paginación">
      <span>{total} resultados · página {pagina} de {paginas}</span>
      {pagina > 1 && <a className="btn btn-light btn-sm" href={href(pagina - 1)}>Anterior</a>}
      {pagina < paginas && <a className="btn btn-light btn-sm" href={href(pagina + 1)}>Siguiente</a>}
    </nav>
  )
}
