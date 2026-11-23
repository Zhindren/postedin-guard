"use client"

import { useActionState, useState } from "react"
import type { EstadoForm } from "@/lib/resultado"

type Accion = (prev: EstadoForm) => Promise<EstadoForm>

export function TokenPanel({ tieneToken, activo, emitir, revocar }: { tieneToken: boolean; activo: boolean; emitir: Accion; revocar: Accion }) {
  const [estadoEmitir, accionEmitir, emitiendo] = useActionState<EstadoForm>(emitir, {})
  const [estadoRevocar, accionRevocar, revocando] = useActionState<EstadoForm>(revocar, {})
  const [copiado, setCopiado] = useState(false)
  const token = estadoEmitir.token
  const error = estadoEmitir.error ?? estadoRevocar.error

  return (
    <div className="stack">
      {error && <div className="alert danger" role="alert">{error}</div>}
      {token ? (
        <>
          <div className="alert warn" role="status">{estadoEmitir.ok}</div>
          <div className="token-box">
            <code className="code" aria-label="Token de integración">{token}</code>
            <button type="button" className="btn btn-light" onClick={async () => {
              await navigator.clipboard.writeText(token)
              setCopiado(true)
            }}>{copiado ? "Copiado" : "Copiar"}</button>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Guárdalo en GitHub como secret <span className="mono">GUARD_TOKEN</span> del repositorio, junto a <span className="mono">GUARD_URL</span>.
          </p>
        </>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {estadoRevocar.ok ?? (tieneToken
            ? "Hay un token vigente. Por seguridad no se puede volver a mostrar; si se perdió, genera uno nuevo."
            : "Este repositorio no tiene token: GitHub Actions no puede enviar análisis.")}
        </p>
      )}
      <div className="actions" style={{ justifyContent: "flex-start" }}>
        <form action={accionEmitir} onSubmit={(e) => {
          if (tieneToken && !window.confirm("El token actual dejará de funcionar. ¿Generar uno nuevo?")) e.preventDefault()
        }}>
          <button type="submit" className="btn btn-primary" disabled={emitiendo || !activo}>
            {emitiendo ? "Generando…" : tieneToken ? "Regenerar token" : "Generar token"}
          </button>
        </form>
        {tieneToken && (
          <form action={accionRevocar} onSubmit={(e) => {
            if (!window.confirm("Los análisis con este token serán rechazados. ¿Revocarlo?")) e.preventDefault()
          }}>
            <button type="submit" className="btn btn-danger" disabled={revocando}>{revocando ? "Revocando…" : "Revocar"}</button>
          </form>
        )}
      </div>
    </div>
  )
}
