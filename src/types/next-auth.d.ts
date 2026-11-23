import type { RolNombre } from "@/lib/roles"

declare module "next-auth" {
  interface User {
    rol?: RolNombre
    versionSesion?: number
  }
  interface Session {
    user: {
      uid: number
      email: string
      name: string
      rol: RolNombre
    }
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: number
    rol?: RolNombre
    nombre?: string
    v?: number
    inicio?: number
    ultimaActividad?: number
  }
}
