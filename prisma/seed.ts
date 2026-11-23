import "dotenv/config"
import bcrypt from "bcryptjs"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import {
  CATALOGO_CATEGORIAS, CATALOGO_CHECKLIST, CATALOGO_HERRAMIENTAS, CATALOGO_ROLES,
  CATALOGO_SEVERIDADES, ROLES,
} from "./catalogos"

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

async function main() {
  for (const r of CATALOGO_ROLES) {
    await prisma.rol.upsert({ where: { nombre: r.nombre }, update: {}, create: r })
  }
  for (const s of CATALOGO_SEVERIDADES) {
    await prisma.severidad.upsert({ where: { nombre: s.nombre }, update: {}, create: s })
  }
  for (const c of CATALOGO_CATEGORIAS) {
    await prisma.categoriaHallazgo.upsert({ where: { nombre: c.nombre }, update: {}, create: c })
  }
  for (const h of CATALOGO_HERRAMIENTAS) {
    await prisma.herramienta.upsert({ where: { nombre: h.nombre }, update: {}, create: h })
  }
  if ((await prisma.itemChecklist.count()) === 0) {
    await prisma.itemChecklist.createMany({
      data: CATALOGO_CHECKLIST.map((pregunta, i) => ({ pregunta, orden: i + 1 })),
    })
  }
  const alta = await prisma.severidad.findUniqueOrThrow({ where: { nombre: "Alta" } })
  await prisma.politicaSeguridad.upsert({
    where: { nombre: "Base Postedin" },
    update: {},
    create: {
      nombre: "Base Postedin",
      descripcion: "Bloquea hallazgos de severidad Alta o superior y exige el checklist IA.",
      severidadBloqueoId: alta.id,
      exigeChecklistIa: true,
    },
  })

  const email = process.env.GUARD_SEED_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.GUARD_SEED_ADMIN_PASSWORD
  if (!email || !password) {
    console.log("seed: sin GUARD_SEED_ADMIN_EMAIL/PASSWORD, no se crea el primer Líder")
    return
  }
  const lider = await prisma.rol.findUniqueOrThrow({ where: { nombre: ROLES.LIDER } })
  const existe = await prisma.usuario.findUnique({ where: { email } })
  if (!existe) {
    await prisma.usuario.create({
      data: {
        email,
        nombre: process.env.GUARD_SEED_ADMIN_NAME ?? "Líder",
        apellido: process.env.GUARD_SEED_ADMIN_LASTNAME ?? "Técnico",
        passwordHash: await bcrypt.hash(password, 12),
        rolId: lider.id,
      },
    })
    console.log(`seed: Líder Técnico creado (${email})`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
