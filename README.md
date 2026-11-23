# Postedin Guard

Plataforma web de seguridad y calidad para el desarrollo de software asistido por inteligencia artificial.

Cada vez que se abre un pull request, GitHub Actions analiza el cambio con **gitleaks** (claves expuestas), **npm audit** (librerías vulnerables), **Semgrep** (código inseguro) y las **pruebas automáticas**, y envía el resultado a Guard. Guard guarda cada problema como un *hallazgo* con severidad, responsable y plazo, aplica las políticas del repositorio y responde **APROBADO** o **BLOQUEADO**.

> **Edición académica.** Este repositorio es la versión pública del proyecto de título de Sergio Maldonado (IPLACEX, 2026), desarrollado para el equipo técnico de Postedin. Contiene el código completo de la plataforma y su base de datos, pero no la configuración de producción de la empresa ni sus datos: la demostración usa solo datos ficticios.

- **Demostración:** https://postedin-guard-demo.vercel.app (las cuentas de prueba están en el informe del proyecto)
- **Documentación:** [frontend](docs/frontend.md) · [backend](docs/backend.md) · [base de datos](docs/base-de-datos.md)

## Funcionalidades

| Perfil | Puede |
|---|---|
| **Líder Técnico** | Administrar usuarios, repositorios (con su token de integración) y políticas de seguridad; asignar hallazgos; ver todos los indicadores, la bitácora de auditoría y exportar CSV. |
| **Desarrollador** | Ver el dashboard con sus hallazgos, cambiar el estado y comentar los hallazgos asignados, marcar falsos positivos con justificación y completar el checklist de revisión de código generado con IA. |
| **GitHub Actions** (sistema) | Enviar el análisis de cada commit a `POST /api/ingesta` con el token del repositorio y recibir el resultado del quality gate. |

Seguridad incluida: contraseñas con bcrypt, bloqueo tras 5 intentos fallidos, sesiones que vencen a los 30 minutos sin uso o a las 8 horas, tokens guardados solo como SHA-256, autorización validada en el servidor en cada acción (con una prueba que lo exige) y ningún secreto ni código fuente almacenado.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, **CSS propio** (sin Bootstrap ni Tailwind), responsive desde 360 px |
| Backend | Server Actions y Route Handlers de Next.js, Auth.js 5, zod, bcryptjs |
| Base de datos | PostgreSQL, Prisma ORM 7 y Prisma Migrate (15 tablas en 3FN, una vista) |
| Calidad | Vitest con cobertura mínima de 70 % en `src/lib`, ESLint, GitHub Actions |
| Análisis | gitleaks, npm audit y Semgrep con reglas propias (`semgrep/postedin.yml`) |

## Estructura

```
src/app/(auth)/        login, recuperar y restablecer contraseña          ← frontend
src/app/(app)/         dashboard, hallazgos, escaneos, repositorios,       ← frontend + server actions
                       políticas, usuarios, bitácora y perfil
src/app/api/           ingesta (GitHub Actions), exportación CSV, Auth.js  ← backend (API)
src/lib/               lógica de negocio: quality gate, ingesta, permisos,  ← backend (dominio)
                       sesiones, hallazgos, dashboard, auditoría
src/proxy.ts           redirige al login a quien no tiene sesión
prisma/                schema.prisma, migraciones, catálogos y datos demo  ← base de datos
database/              esquema SQL completo y catálogos, para revisarlos sin Prisma
scripts/               guard-scan.mjs (lo usa la CI) y lectores de reportes
semgrep/, gitleaks.toml  reglas de análisis
ejemplos/              workflow para conectar otro repositorio a Guard
docs/                  documentación de frontend, backend y base de datos
```

## Levantarlo en local

Requisitos: Node.js 24 y PostgreSQL 16 o superior con una base vacía.

```bash
cp .env.example .env        # completar DATABASE_URL y AUTH_SECRET (npx auth secret)
npm install
npx prisma migrate deploy   # crea las tablas, restricciones y la vista
npx prisma db seed          # catálogos y, si se definen GUARD_SEED_ADMIN_*, el primer Líder
npx tsx prisma/demo.ts      # opcional: cuentas de prueba y tres semanas de análisis ficticios
npm run dev                 # http://localhost:3100
```

Las cuentas de prueba que crea `prisma/demo.ts` son `lider@demo.test` (Líder Técnico) y `dev1@demo.test` / `dev2@demo.test` (Desarrolladores). Para crear cuentas `@demo.test` desde la aplicación, agregar ese dominio a `GUARD_ALLOWED_EMAIL_DOMAINS`.

## Comandos

```bash
npm run lint && npx tsc --noEmit    # estilo y tipos
npm test                            # pruebas (npm run test:coverage exige 70 % en src/lib)
npm run build                       # build de producción
```

La CI (`.github/workflows/ci.yml`) corre lo mismo en cada pull request.

## Enviar un análisis

Desde el repositorio que se quiere analizar, con el token que Guard muestra en la ficha del repositorio:

```bash
npm audit --json > npm-audit.json
GUARD_URL=http://localhost:3100 GUARD_TOKEN=<token> \
  node ruta/a/postedin-guard/scripts/guard-scan.mjs --npm-audit npm-audit.json --sql \
  --commit <sha de 40 caracteres> --rama mi-rama --pr 1 --autor mi-usuario
```

Con `--dry-run` muestra lo que enviaría sin contactar a Guard. En `ejemplos/analisis-con-guard.yml` hay un workflow completo de GitHub Actions; con `GUARD_ENFORCE=true` un BLOQUEADO hace fallar el job, y sin esa variable solo informa.

## Despliegue de demostración

La demo corre en Vercel (plan Hobby) con una base PostgreSQL gratuita de Neon conectada desde Vercel → Storage. Con `GUARD_DEMO=1`, `scripts/vercel-build.mjs` aplica las migraciones, carga los catálogos y los datos ficticios en cada build, y las cuentas de prueba no se pueden desactivar ni cambiar de contraseña. Variables: `DATABASE_URL` y `DATABASE_URL_UNPOOLED` (las crea Neon), `GUARD_PUBLIC_URL`, `GUARD_ALLOWED_EMAIL_DOMAINS=demo.test` y `GUARD_DEMO=1`. Si no se define `AUTH_SECRET`, el build de la demo genera una clave de sesión aleatoria por despliegue.
