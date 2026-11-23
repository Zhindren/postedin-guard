import type { Metadata } from "next"
import Link from "next/link"
import { enlaceVigente } from "@/lib/auth/recuperacion"
import { RestablecerForm } from "./restablecer-form"

export const metadata: Metadata = { title: "Nueva contraseña" }

export default async function RestablecerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const vigente = await enlaceVigente(token)
  return (
    <>
      <h2>Nueva contraseña</h2>
      {vigente ? (
        <>
          <p className="lead">Al guardarla se cerrarán todas tus sesiones abiertas.</p>
          <RestablecerForm token={token} />
        </>
      ) : (
        <div className="stack">
          <div className="alert warn" role="alert">El enlace no es válido o ya venció.</div>
          <Link href="/recuperar">Pedir un enlace nuevo</Link>
        </div>
      )}
    </>
  )
}
