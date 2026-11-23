"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import type { EstadoForm } from "@/lib/resultado"

type Props = {
  action: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>
  boton: string
  pendiente?: string
  variante?: "primary" | "light" | "danger"
  limpiarAlGuardar?: boolean
  confirmar?: string
  compacto?: boolean
  children?: React.ReactNode
}

export function FormAccion({ action, boton, pendiente, variante = "primary", limpiarAlGuardar, confirmar, compacto, children }: Props) {
  const [estado, accion, enCurso] = useActionState<EstadoForm, FormData>(action, {})
  const [copiado, setCopiado] = useState(false)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (estado.ok && limpiarAlGuardar) ref.current?.reset()
  }, [estado, limpiarAlGuardar])
  return (
    <form ref={ref} action={accion} className={compacto ? "row" : "form"}
      onSubmit={(e) => { if (confirmar && !window.confirm(confirmar)) e.preventDefault() }}>
      {!compacto && estado.error && <div className="alert danger" role="alert">{estado.error}</div>}
      {!compacto && estado.ok && <div className={`alert ${estado.enlace ? "warn" : "ok"}`} role="status">{estado.ok}</div>}
      {!compacto && estado.enlace && (
        <div className="token-box">
          <code className="code" aria-label="Enlace de acceso">{estado.enlace}</code>
          <button type="button" className="btn btn-light" onClick={async () => {
            await navigator.clipboard.writeText(estado.enlace ?? "")
            setCopiado(true)
          }}>{copiado ? "Copiado" : "Copiar"}</button>
        </div>
      )}
      {children}
      <div className={compacto ? undefined : "actions"}>
        <button type="submit" className={`btn btn-${variante}${compacto ? " btn-sm" : ""}`} disabled={enCurso}>
          {enCurso ? (pendiente ?? "Guardando…") : boton}
        </button>
      </div>
      {compacto && estado.error && <span className="error-msg" role="alert">{estado.error}</span>}
    </form>
  )
}
