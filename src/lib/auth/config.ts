import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { ipDesdeHeaders } from "@/lib/audit"
import { autenticar } from "./login"
import { estadoCuenta } from "./estado-cuenta"
import { DURACION_MAXIMA_SESION_MS, evaluarSesion } from "./reglas"
import { modoDemo } from "@/lib/env"
import { SECRETO_DEMO } from "./secreto-demo"

class CredencialesInvalidas extends CredentialsSignin {
  code = "credenciales"
}
class CuentaBloqueada extends CredentialsSignin {
  code = "bloqueada"
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET || (modoDemo() ? SECRETO_DEMO ?? undefined : undefined),
  session: { strategy: "jwt", maxAge: DURACION_MAXIMA_SESION_MS / 1000 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const r = await autenticar(credentials, ipDesdeHeaders(request.headers))
        if (!r.ok) throw r.motivo === "bloqueada" ? new CuentaBloqueada() : new CredencialesInvalidas()
        return r.usuario
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const ahora = Date.now()
      if (user) {
        token.uid = Number(user.id)
        token.rol = user.rol
        token.nombre = user.name ?? ""
        token.v = user.versionSesion ?? 0
        token.inicio = ahora
        token.ultimaActividad = ahora
        return token
      }
      if (!token.uid || token.inicio === undefined || token.ultimaActividad === undefined || token.v === undefined) {
        return null
      }
      const cuenta = await estadoCuenta(token.uid)
      const estado = evaluarSesion(
        { inicio: token.inicio, ultimaActividad: token.ultimaActividad, version: token.v },
        cuenta,
        ahora,
      )
      if (estado !== "vigente" || !cuenta) return null
      token.rol = cuenta.rol
      token.nombre = cuenta.nombre
      token.ultimaActividad = ahora
      return token
    },
    session({ session, token }) {
      session.user = {
        ...session.user,
        uid: token.uid as number,
        name: token.nombre ?? "",
        rol: token.rol!,
      }
      return session
    },
  },
})
