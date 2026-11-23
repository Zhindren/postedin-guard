"use client"

import { useActionState } from "react"
import { guardarNuevaPassword, type EstadoRestablecer } from "./actions"

export function RestablecerForm({ token }: { token: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoRestablecer, FormData>(guardarNuevaPassword, {})
  return (
    <form action={accion} className="form">
      {estado.error && <div className="alert danger" role="alert">{estado.error}</div>}
      <input type="hidden" name="token" value={token} />
      <div className="field">
        <label htmlFor="password">Nueva contraseña</label>
        <input id="password" name="password" type="password" className="input" required minLength={12} autoComplete="new-password" />
        <span className="hint">Mínimo 12 caracteres, con letras y números.</span>
      </div>
      <div className="field">
        <label htmlFor="confirmacion">Repite la contraseña</label>
        <input id="confirmacion" name="confirmacion" type="password" className="input" required minLength={12} autoComplete="new-password" />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  )
}
