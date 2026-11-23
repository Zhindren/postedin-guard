import { ROLES } from "../src/lib/roles"

export { ROLES }

export const CATALOGO_ROLES = [
  { nombre: ROLES.LIDER, descripcion: "Administra repositorios, políticas, usuarios y asigna hallazgos" },
  { nombre: ROLES.DESARROLLADOR, descripcion: "Atiende hallazgos asignados y completa el checklist de revisión IA" },
]

export const CATALOGO_SEVERIDADES = [
  { nombre: "Crítica", nivel: 4, plazoDias: 2 },
  { nombre: "Alta", nivel: 3, plazoDias: 7 },
  { nombre: "Media", nivel: 2, plazoDias: 30 },
  { nombre: "Baja", nivel: 1, plazoDias: 90 },
]

export const CATALOGO_CATEGORIAS = [
  { nombre: "Secreto expuesto", descripcion: "Credenciales, tokens o llaves en el código o historial", referenciaOwasp: "A07:2021" },
  { nombre: "Dependencia vulnerable", descripcion: "Librería con vulnerabilidad conocida u obsoleta", referenciaOwasp: "A06:2021" },
  { nombre: "Permisos de API", descripcion: "Endpoint sin autenticación o control de acceso por rol", referenciaOwasp: "API5:2023" },
  { nombre: "Gestión de sesiones", descripcion: "Cookies, expiración o revocación de sesiones inseguras", referenciaOwasp: "A07:2021" },
  { nombre: "Código inseguro", descripcion: "Patrones inseguros detectados por análisis estático", referenciaOwasp: "A03:2021" },
  { nombre: "Migraciones", descripcion: "Cambios de esquema fuera del proceso de migraciones", referenciaOwasp: null },
  { nombre: "Calidad y pruebas", descripcion: "Pruebas fallidas o cobertura bajo el umbral", referenciaOwasp: null },
  { nombre: "Documentación", descripcion: "Comentarios redundantes o documentación desalineada con el código", referenciaOwasp: null },
]

export const CATALOGO_HERRAMIENTAS = [
  { nombre: "gitleaks", tipoAnalisis: "Secretos", version: "8.x" },
  { nombre: "npm audit", tipoAnalisis: "Dependencias", version: "11.x" },
  { nombre: "Semgrep", tipoAnalisis: "SAST", version: "1.x" },
  { nombre: "Vitest", tipoAnalisis: "Pruebas", version: "4.x" },
]

export const CATALOGO_CHECKLIST = [
  "¿El código generado por IA evita incluir secretos, tokens o credenciales?",
  "¿Se validan las entradas del usuario y los permisos en cada endpoint nuevo?",
  "¿Las dependencias agregadas por sugerencia de la IA son necesarias, vigentes y sin vulnerabilidades?",
  "¿Los cambios de base de datos se realizaron mediante migraciones versionadas?",
  "¿Se agregaron o actualizaron pruebas automatizadas para el cambio?",
  "¿Se eliminaron comentarios redundantes y la documentación se limita a decisiones de producto?",
]
