# Frontend

La interfaz está hecha con Next.js 16 (App Router) y React 19. Las páginas son **Server Components**: leen los datos en el servidor y llegan al navegador ya renderizadas. Los formularios son **Client Components** pequeños que envían a una Server Action con `useActionState` y muestran los errores de validación que devuelve el servidor.

## Diseño

- CSS propio en `src/app/globals.css`, sin Bootstrap, Tailwind ni plantillas. Variables CSS para colores, espacios y radios.
- Responsive desde 360 px: el menú lateral pasa a un botón en pantallas chicas, las grillas de indicadores se reorganizan y las tablas se desplazan dentro de su tarjeta sin desbordar la página.
- Gráficos del dashboard dibujados con CSS (barras apiladas por severidad y por categoría), sin librerías.
- Insignias de severidad, estado y resultado del quality gate en `src/components/badges.tsx`.

## Rutas

| Ruta | Perfil | Contenido |
|---|---|---|
| `/login` | Público | Inicio de sesión con correo y contraseña |
| `/recuperar` | Público | Solicitud de enlace de recuperación |
| `/restablecer/[token]` | Público | Nueva contraseña desde un enlace de un solo uso |
| `/` | Ambos | Dashboard: indicadores, hallazgos por semana y categoría, últimos escaneos. El Desarrollador ve solo lo suyo |
| `/hallazgos` | Ambos | Lista con filtros (repositorio, severidad, estado, responsable y texto) y exportación CSV (Líder) |
| `/hallazgos/[id]` | Ambos | Evidencia sin secretos, estado, responsable, comentarios e historial |
| `/escaneos` | Ambos | Análisis recibidos con su resultado |
| `/escaneos/[id]` | Ambos | Resultado del gate, hallazgos presentes y checklist de revisión IA |
| `/repositorios`, `/repositorios/[id]` | Líder | Registro, responsable, políticas y token de integración |
| `/politicas` | Líder | Políticas del quality gate |
| `/usuarios`, `/usuarios/[id]` | Líder | Cuentas, perfil, activación e invitaciones |
| `/bitacora` | Líder | Bitácora de auditoría con filtros |
| `/perfil` | Ambos | Datos personales y cambio de contraseña |

El menú (`src/components/sidebar.tsx`) muestra solo las secciones del perfil. Ocultar un enlace no protege nada: cada página vuelve a validar el perfil en el servidor (ver [backend](backend.md)).

## Formularios

Inicio de sesión, recuperación y restablecimiento de contraseña, perfil y cambio de contraseña, creación y edición de usuarios, registro y edición de repositorios (con generación y revocación del token), políticas y su asignación, asignación de responsable, cambio de estado y comentarios de un hallazgo, y checklist de revisión IA. Todos se validan en el servidor con zod; la validación del navegador (`required`, `maxLength`) es solo una ayuda.
