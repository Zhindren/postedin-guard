"use client"

import { useActionState } from "react"
import { pedirEnlace, type EstadoRecuperar } from "./actions"

export function RecuperarForm() {
  const [estado, accion, pendiente] = useActionState<EstadoRecuperar, FormData>(pedirEnlace, {})
  if (estado.enviado) {
    return (
      <div className="alert ok" role="status">
        Si el correo está registrado, te llegará un enlace para restablecer la contraseña.
      </div>
    )
  }
  return (
    <form action={accion} className="form">
      <div className="field">
        <label htmlFor="email">Correo corporativo</label>
        <input id="email" name="email" type="email" className="input" required maxLength={120} autoComplete="email" />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pendiente}>
        {pendiente ? "Enviando…" : "Enviar enlace"}
      </button>
    </form>
  )
}
