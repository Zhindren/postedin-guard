# Backend

El backend vive en el mismo proyecto de Next.js, separado en capas:

| Capa | Dónde | Responsabilidad |
|---|---|---|
| Control | `src/proxy.ts`, `src/app/**/actions.ts`, `src/app/api/**/route.ts` | Recibir la solicitud, validar sesión y perfil, delegar en el dominio |
| Dominio | `src/lib/` | Reglas del negocio, sin depender de la interfaz |
| Acceso a datos | `src/lib/db.ts`, `prisma/` | Prisma Client con el adaptador `pg`, transacciones y migraciones |

## API

| Endpoint | Autenticación | Uso |
|---|---|---|
| `POST /api/ingesta` | `Authorization: Bearer <token del repositorio>` | GitHub Actions envía el análisis de un commit. Responde el resultado del gate |
| `GET /api/hallazgos/export` | Sesión de Líder | CSV de la lista de hallazgos con los filtros activos |
| `/api/auth/*` | Auth.js | Inicio y cierre de sesión |

Respuestas de `/api/ingesta`: `201` con `{ escaneoId, resultado, motivos, hallazgosNuevos, hallazgosExistentes, hallazgosResueltos, url }`; `401` token inválido o revocado; `429` más de 60 solicitudes por minuto; `400` datos inválidos (indica el campo); `413` cuerpo mayor a 5 MB.

## Módulos de dominio (`src/lib`)

| Módulo | Qué hace |
|---|---|
| `auth/` | Login con bloqueo de 15 min tras 5 fallos (contados en la bitácora), reglas de sesión (30 min sin uso, 8 h máximo, `version_sesion`), recuperación e invitaciones con enlaces de un solo uso guardados como SHA-256 |
| `gate.ts` | Motor de políticas: función pura que recibe políticas, severidades, cobertura y pruebas y devuelve APROBADO, BLOQUEADO o ERROR con sus motivos |
| `ingesta/` | Esquema zod del análisis y `procesarIngesta`: en una transacción crea o actualiza el escaneo, inserta solo los hallazgos nuevos (huella), registra en `deteccion` todos los presentes, reabre los que vuelven y, en la rama principal, resuelve los que ya no aparecen (solo de las herramientas que corrieron) |
| `hallazgos.ts` | Filtros, estados, asignación y comentarios. El Desarrollador solo modifica lo asignado a él (`puedeGestionar`) |
| `escaneos.ts`, `checklist.ts` | Checklist de revisión IA y reevaluación del gate al completarlo |
| `usuarios.ts`, `repositorios.ts`, `politicas.ts` | Administración; tokens de repositorio mostrados una vez y guardados como SHA-256 |
| `dashboard.ts` | Indicadores según el perfil |
| `csv.ts` | Exportación protegida contra inyección de fórmulas |
| `audit.ts` | Bitácora de auditoría |
| `avisos.ts`, `mail.ts` | Avisos opcionales por Slack y correo (Resend). Sin credenciales quedan apagados |

## Autorización

- Toda Server Action llama a `ctxLider()` o `ctxUsuario()` (`src/lib/acciones.ts`); toda página privada, a `requireUser()` o `requireLider()`; todo route handler, a `apiRequireLider()`/`apiRequireUser()` o a `repositorioPorToken()`.
- `src/app/autorizacion.test.ts` recorre el código y falla si alguna acción, página o handler no lo hace.
- El proxy solo redirige al login; nunca es la única barrera.

## Pruebas

`npm run test:coverage`: pruebas unitarias del dominio (gate, ingesta, sesiones, tokens, CSV, permisos), de rutas (códigos 401/403/400/429/201), de los lectores de reportes con fixtures y la prueba estructural de autorización. Umbral: 70 % de líneas, funciones y sentencias y 60 % de ramas en `src/lib`.

## Integración con GitHub Actions

`scripts/guard-scan.mjs` lee los reportes de gitleaks, npm audit, Semgrep, Vitest y cobertura, los normaliza con `scripts/parsers.mjs` (que descarta el valor de los secretos y el código), detecta archivos `.sql` fuera de `prisma/migrations` y envía todo a `/api/ingesta`. Escribe el resultado en el resumen del job y, con `GUARD_ENFORCE=true`, sale con error si el análisis queda BLOQUEADO.
