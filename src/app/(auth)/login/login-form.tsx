"use client"

import Link from "next/link"
import { useActionState } from "react"
import { iniciarSesion, type EstadoLogin } from "./actions"

export function LoginForm({ aviso }: { aviso?: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoLogin, FormData>(iniciarSesion, {})
  return (
    <form action={accion} className="form" noValidate>
      {aviso && !estado.error && <div className="alert info" role="status">{aviso}</div>}
      {estado.error && <div className="alert danger" role="alert">{estado.error}</div>}
      <div className="field">
        <label htmlFor="email">Correo corporativo</label>
        <input id="email" name="email" type="email" className="input" autoComplete="username"
          defaultValue={estado.email} required maxLength={120} placeholder="nombre@postedin.com" />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pendiente}>
        {pendiente ? "Ingresando…" : "Ingresar"}
      </button>
      <p className="muted" style={{ margin: 0, textAlign: "center" }}>
        <Link href="/recuperar">¿Olvidaste tu contraseña?</Link>
      </p>
    </form>
  )
}
