import type { Metadata } from "next"
import { modoDemo } from "@/lib/env"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Iniciar sesión" }

const AVISOS: Record<string, string> = {
  restablecida: "Contraseña actualizada. Ingresa con la nueva.",
  cerrada: "Tu sesión se cerró. Vuelve a ingresar.",
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { aviso } = await searchParams
  return (
    <>
      <h2>Iniciar sesión</h2>
      <p className="lead">{modoDemo() ? "Demostración con datos ficticios: usa una de las cuentas de prueba." : "Usa tu correo de Postedin."}</p>
      <LoginForm aviso={aviso ? AVISOS[aviso] : undefined} />
    </>
  )
}
