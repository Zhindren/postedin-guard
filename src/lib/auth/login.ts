import { z } from "zod"
import { prisma } from "@/lib/db"
import { registrarEvento } from "@/lib/audit"
import { esRolValido, type RolNombre } from "@/lib/roles"
import { hashSeñuelo, verificarPassword } from "./password"
import { INTENTOS_MAXIMOS, VENTANA_BLOQUEO_MS, bloqueadaHasta } from "./reglas"

export type UsuarioSesion = {
  id: string
  email: string
  name: string
  rol: RolNombre
  versionSesion: number
}

export type ResultadoLogin =
  | { ok: true; usuario: UsuarioSesion }
  | { ok: false; motivo: "credenciales" | "bloqueada" }

const entrada = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(1).max(200),
})

export async function autenticar(datos: unknown, ip: string | null, ahora = new Date()): Promise<ResultadoLogin> {
  const parsed = entrada.safeParse(datos)
  if (!parsed.success) return { ok: false, motivo: "credenciales" }
  const { email, password } = parsed.data

  const usuario = await prisma.usuario.findUnique({ where: { email }, include: { rol: true } })
  if (!usuario) {
    await verificarPassword(password, await hashSeñuelo())
    await registrarEvento({ accion: "LOGIN_FALLIDO", entidad: "usuario", detalle: "correo no registrado", ip })
    return { ok: false, motivo: "credenciales" }
  }

  const fallos = await prisma.bitacoraAuditoria.findMany({
    where: {
      usuarioId: usuario.id,
      accion: "LOGIN_FALLIDO",
      fechaEvento: { gt: new Date(ahora.getTime() - VENTANA_BLOQUEO_MS) },
    },
    select: { fechaEvento: true },
  })
  const fechasFallo = fallos.map((f) => f.fechaEvento)
  if (bloqueadaHasta(fechasFallo, usuario.ultimoAcceso, ahora)) {
    await registrarEvento({ usuarioId: usuario.id, accion: "LOGIN_BLOQUEADO", entidad: "usuario", entidadId: usuario.id, ip })
    return { ok: false, motivo: "bloqueada" }
  }

  const passwordOk = await verificarPassword(password, usuario.passwordHash)
  if (!passwordOk || !usuario.activo || !esRolValido(usuario.rol.nombre)) {
    await registrarEvento({
      usuarioId: usuario.id,
      accion: "LOGIN_FALLIDO",
      entidad: "usuario",
      entidadId: usuario.id,
      detalle: !usuario.activo ? "cuenta desactivada" : "contraseña incorrecta",
      ip,
    })
    const quedaBloqueada = bloqueadaHasta([...fechasFallo, ahora], usuario.ultimoAcceso, ahora)
    if (quedaBloqueada) {
      await registrarEvento({
        usuarioId: usuario.id,
        accion: "CUENTA_BLOQUEADA",
        entidad: "usuario",
        entidadId: usuario.id,
        detalle: `${INTENTOS_MAXIMOS} intentos fallidos`,
        ip,
      })
      return { ok: false, motivo: "bloqueada" }
    }
    return { ok: false, motivo: "credenciales" }
  }

  await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoAcceso: ahora } })
  await registrarEvento({ usuarioId: usuario.id, accion: "LOGIN_OK", entidad: "usuario", entidadId: usuario.id, ip })
  return {
    ok: true,
    usuario: {
      id: String(usuario.id),
      email: usuario.email,
      name: `${usuario.nombre} ${usuario.apellido}`,
      rol: usuario.rol.nombre as RolNombre,
      versionSesion: usuario.versionSesion,
    },
  }
}
