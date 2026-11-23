import type { Metadata } from "next"
import Link from "next/link"
import { RecuperarForm } from "./recuperar-form"

export const metadata: Metadata = { title: "Recuperar contraseña" }

export default function RecuperarPage() {
  return (
    <>
      <h2>Recuperar contraseña</h2>
      <p className="lead">Te enviaremos un enlace para definir una nueva. Vale 30 minutos.</p>
      <RecuperarForm />
      <p className="muted" style={{ textAlign: "center" }}><Link href="/login">Volver al inicio de sesión</Link></p>
    </>
  )
}
