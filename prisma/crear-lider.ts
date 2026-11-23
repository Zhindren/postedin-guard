// Crea (o reactiva) un Líder Técnico pidiendo la contraseña por teclado, sin mostrarla, para
// que nunca quede en variables de entorno, archivos ni historial de la terminal.
//
//   npx tsx --env-file=.env.production.local prisma/crear-lider.ts correo@postedin.com "Nombre" "Apellido"

import { createInterface } from "node:readline"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { hashPassword, validarPassword } from "../src/lib/auth/password"
import { ROLES } from "../src/lib/roles"

const ENTER = new Set(["\r", "\n"])
const BORRAR = new Set(["\b", "\x7f"])
const CTRL_C = "\x03"

/** Lee una línea sin mostrarla: en la terminal muestra un * por carácter para que se vea que escribe. */
function preguntarOculto(texto: string): Promise<string> {
  process.stdout.write(texto)
  const stdin = process.stdin
  if (!stdin.isTTY) {
    return new Promise((resolve) => {
      const rl = createInterface({ input: stdin, terminal: false })
      rl.once("line", (l) => {
        rl.close()
        process.stdout.write("\n")
        resolve(l)
      })
    })
  }
  return new Promise((resolve) => {
    let valor = ""
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding("utf8")
    const alTeclear = (chunk: string) => {
      for (const c of chunk) {
        if (ENTER.has(c)) {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off("data", alTeclear)
          process.stdout.write("\n")
          resolve(valor)
          return
        }
        if (c === CTRL_C) {
          process.stdout.write("\n")
          process.exit(130)
        }
        if (BORRAR.has(c)) {
          if (valor.length > 0) {
            valor = valor.slice(0, -1)
            process.stdout.write("\b \b")
          }
          continue
        }
        if (c >= " ") {
          valor += c
          process.stdout.write("*")
        }
      }
    }
    stdin.on("data", alTeclear)
  })
}

async function main() {
  const [emailArg, nombre = "Líder", apellido = "Técnico"] = process.argv.slice(2)
  const email = emailArg?.trim().toLowerCase()
  if (!email || !email.includes("@")) {
    console.error("Uso: npx tsx --env-file=.env.production.local prisma/crear-lider.ts correo@postedin.com [nombre] [apellido]")
    process.exit(1)
  }
  const password = await preguntarOculto(`Contraseña para ${email} (no se muestra): `)
  const error = validarPassword(password)
  if (error) {
    console.error(`${error} (escribiste ${password.length} caracteres)`)
    process.exit(1)
  }
  if ((await preguntarOculto("Repítela: ")) !== password) {
    console.error("Las contraseñas no coinciden.")
    process.exit(1)
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
  try {
    const lider = await prisma.rol.findUniqueOrThrow({ where: { nombre: ROLES.LIDER } })
    const passwordHash = await hashPassword(password)
    const existe = await prisma.usuario.findUnique({ where: { email }, select: { id: true, versionSesion: true } })
    if (existe) {
      await prisma.usuario.update({
        where: { id: existe.id },
        data: { passwordHash, rolId: lider.id, activo: true, versionSesion: existe.versionSesion + 1 },
      })
      console.log(`Líder Técnico actualizado: ${email}`)
    } else {
      await prisma.usuario.create({ data: { email, nombre, apellido, passwordHash, rolId: lider.id } })
      console.log(`Líder Técnico creado: ${email}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error((e as Error).message)
  process.exit(1)
})
