export type PoliticaGate = {
  nombre: string
  nivelBloqueo: number
  etiquetaBloqueo: string
  coberturaMinima: number | null
  exigeChecklistIa: boolean
}

export type EntradaGate = {
  politicas: PoliticaGate[]
  /** Nivel de severidad (1 a 4) de cada hallazgo presente en el análisis, sin los falsos positivos. */
  niveles: number[]
  cobertura: number | null
  pruebasFallidas: number
  /** false cuando no llegó el reporte de pruebas (por ejemplo, la CI se cortó antes de terminarlas). */
  pruebasEjecutadas: boolean
}

export type Resultado = "APROBADO" | "BLOQUEADO" | "ERROR"

export const MOTIVO_CHECKLIST = "Falta completar el checklist de revisión IA."
export const MOTIVO_SIN_PRUEBAS = "No llegó el reporte de pruebas: el análisis no se puede aprobar."

/**
 * Quality gate del análisis: hallazgos, pruebas y cobertura. Es una función pura para que la
 * regla de bloqueo sea la misma en la ingesta y al reevaluar. Sin reporte de pruebas no hay
 * forma de saber si pasan, así que nunca se aprueba: queda en ERROR (o BLOQUEADO si además bloquea).
 */
export function evaluarAnalisis(e: EntradaGate): { resultado: Resultado; motivos: string[] } {
  const motivos: string[] = []
  if (e.pruebasFallidas > 0) {
    motivos.push(`${e.pruebasFallidas} ${e.pruebasFallidas === 1 ? "prueba fallida" : "pruebas fallidas"}.`)
  }
  for (const p of e.politicas) {
    const n = e.niveles.filter((nivel) => nivel >= p.nivelBloqueo).length
    if (n > 0) {
      motivos.push(`${n} ${n === 1 ? "hallazgo" : "hallazgos"} de severidad ${p.etiquetaBloqueo} o superior (política «${p.nombre}»).`)
    }
    if (p.coberturaMinima !== null && e.cobertura !== null && e.cobertura < p.coberturaMinima) {
      motivos.push(`Cobertura ${formatear(e.cobertura)} % bajo el mínimo de ${formatear(p.coberturaMinima)} % (política «${p.nombre}»).`)
    }
  }
  if (motivos.length > 0) return { resultado: "BLOQUEADO", motivos: e.pruebasEjecutadas ? motivos : [...motivos, MOTIVO_SIN_PRUEBAS] }
  if (!e.pruebasEjecutadas) return { resultado: "ERROR", motivos: [MOTIVO_SIN_PRUEBAS] }
  return { resultado: "APROBADO", motivos }
}

export function exigeChecklist(politicas: Pick<PoliticaGate, "exigeChecklistIa">[]): boolean {
  return politicas.some((p) => p.exigeChecklistIa)
}

/** Resultado final: el checklist pendiente bloquea un análisis que por lo demás estaba aprobado. Un ERROR se mantiene. */
export function resultadoFinal(analisis: Resultado, exige: boolean, checklistCompleto: boolean): { resultado: Resultado; motivoChecklist: string | null } {
  if (analisis !== "ERROR" && exige && !checklistCompleto) return { resultado: "BLOQUEADO", motivoChecklist: MOTIVO_CHECKLIST }
  return { resultado: analisis, motivoChecklist: null }
}

export function unirMotivos(motivos: string[]): string | null {
  const texto = motivos.join(" ")
  return texto ? texto.slice(0, 500) : null
}

function formatear(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",")
}
