export const ROLES = {
  LIDER: "LIDER_TECNICO",
  DESARROLLADOR: "DESARROLLADOR",
} as const

export type RolNombre = (typeof ROLES)[keyof typeof ROLES]

export const ETIQUETA_ROL: Record<RolNombre, string> = {
  LIDER_TECNICO: "Líder Técnico",
  DESARROLLADOR: "Desarrollador",
}

export function esRolValido(valor: string): valor is RolNombre {
  return valor === ROLES.LIDER || valor === ROLES.DESARROLLADOR
}
