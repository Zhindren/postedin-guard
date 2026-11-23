# Base de datos

PostgreSQL con un modelo relacional en tercera forma normal: **15 tablas** y la vista `v_hallazgo_plazo`. La estructura se define en `prisma/schema.prisma` y cada cambio es una migración versionada en `prisma/migrations`; nunca se aplica SQL a mano.

![Modelo relacional](../database/diagrama-relacional.png)

El modelo conceptual en notación de Chen está en [`database/diagrama-chen.png`](../database/diagrama-chen.png).

## Tablas

| Tabla | Tipo | Contenido |
|---|---|---|
| `rol` | Catálogo | Perfiles: Líder Técnico y Desarrollador |
| `severidad` | Catálogo | Crítica, Alta, Media y Baja, con su nivel y plazo de corrección en días |
| `categoria_hallazgo` | Catálogo | Tipo de riesgo con su referencia OWASP |
| `herramienta` | Catálogo | gitleaks, npm audit, Semgrep y Vitest |
| `item_checklist` | Catálogo | Preguntas del checklist de revisión de código generado con IA |
| `usuario` | Principal | Cuentas: hash bcrypt, perfil, estado y `version_sesion` |
| `bitacora_auditoria` | Principal | Accesos, cambios y análisis recibidos |
| `repositorio` | Principal | Repositorios de GitHub con responsable y SHA-256 del token |
| `politica_seguridad` | Principal | Reglas del quality gate |
| `escaneo` | Principal | Análisis de un commit y su resultado |
| `hallazgo` | Principal | Problema detectado, con huella, estado y responsable |
| `comentario_hallazgo` | Principal | Comentarios sobre un hallazgo |
| `repositorio_politica` | Intermedia (N:M) | Políticas asignadas a cada repositorio |
| `respuesta_checklist` | Intermedia (N:M) | Respuesta de cada ítem del checklist en un escaneo |
| `deteccion` | Intermedia (N:M) | En qué escaneos apareció cada hallazgo |

`hallazgo.id_escaneo` guarda el escaneo en que el hallazgo se detectó por primera vez; un hallazgo no se duplica entre análisis (se reconoce por su `huella`, un SHA-256 de herramienta, regla y ubicación). `deteccion` registra cada análisis en que siguió presente, para saber qué hallazgos tenía cada pull request.

## Integridad

- Claves primarias, foráneas y únicas en todas las tablas. Por defecto las foráneas son `RESTRICT` para no perder historial; solo se borran en cascada las tablas que dependen por completo de su padre (comentarios, respuestas del checklist, detecciones y asignaciones de políticas).
- Restricciones `CHECK`: nivel de severidad entre 1 y 4 y plazo positivo; porcentajes entre 0 y 100; SHA de commit de 40 caracteres hexadecimales; huella de 64; fecha de cierre posterior a la detección; correos en minúsculas; URLs de GitHub.
- El estado de un hallazgo (`ABIERTO`, `EN_PROGRESO`, `RESUELTO`, `FALSO_POSITIVO`) y el resultado del gate (`APROBADO`, `BLOQUEADO`, `ERROR`) son tipos enumerados de PostgreSQL: la base rechaza cualquier otro valor.
- La fecha límite de cada hallazgo no se guarda: se calcula en la vista `v_hallazgo_plazo` desde el plazo de su severidad.
- Nada sensible: contraseñas con bcrypt; tokens de repositorio, recuperación e invitación como SHA-256; los hallazgos guardan archivo, línea y regla, nunca el valor de un secreto ni código fuente.

## Archivos

| Archivo | Uso |
|---|---|
| `prisma/schema.prisma` | Modelo de datos (fuente de verdad) |
| `prisma/migrations/` | Migraciones: tablas e índices; restricciones CHECK y vista; tabla `deteccion` |
| `prisma/seed.ts` y `prisma/catalogos.ts` | Catálogos y primer Líder Técnico |
| `prisma/demo.ts` | Cuentas de prueba y análisis ficticios |
| `database/esquema.sql` | Las migraciones concatenadas, para revisar el modelo sin Prisma |
| `database/catalogos.sql` | Los catálogos como `INSERT` |

## Crear la base

```bash
npx prisma migrate deploy   # o: psql -f database/esquema.sql
npx prisma db seed          # o: psql -f database/catalogos.sql
npx tsx prisma/demo.ts      # opcional, datos de demostración
```
