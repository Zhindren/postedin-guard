#!/usr/bin/env node
// Build en Vercel. En el despliegue de demostración (GUARD_DEMO=1) además aplica las migraciones,
// carga los catálogos y los datos ficticios antes de compilar. Producción no usa este paso:
// allí las migraciones se aplican a mano con `prisma migrate deploy`.
import { execSync } from "node:child_process"

const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } })

run("npx prisma generate")
if (process.env.GUARD_DEMO === "1") {
  // Las migraciones van por la conexión directa; la app usa la del pooler.
  const directa = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  run("npx prisma migrate deploy", { DATABASE_URL: directa })
  run("npx tsx prisma/seed.ts")
  run("npx tsx prisma/demo.ts")
}
run("npx next build")
