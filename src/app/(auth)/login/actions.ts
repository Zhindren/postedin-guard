"use server"

import { AuthError, CredentialsSignin } from "next-auth"
import { signIn } from "@/lib/auth/config"

export type EstadoLogin = { error?: string; email?: string }

export async function iniciarSesion(_prev: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "")
  try {
    await signIn("credentials", { email, password: String(formData.get("password") ?? ""), redirectTo: "/" })
    return {}
  } catch (e) {
    if (e instanceof AuthError) {
      const bloqueada = e instanceof CredentialsSignin && e.code === "bloqueada"
      return {
        email,
        error: bloqueada
          ? "La cuenta quedó bloqueada por 15 minutos tras 5 intentos fallidos."
          : "Correo o contraseña incorrectos.",
      }
    }
    throw e
  }
}
