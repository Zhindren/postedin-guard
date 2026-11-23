import { describe, expect, it } from "vitest"
import { MOTIVO_CHECKLIST, MOTIVO_SIN_PRUEBAS, evaluarAnalisis, exigeChecklist, resultadoFinal, unirMotivos } from "./gate"

const base = { nombre: "Base", nivelBloqueo: 3, etiquetaBloqueo: "Alta", coberturaMinima: null, exigeChecklistIa: false }

describe("evaluarAnalisis", () => {
  it("aprueba sin hallazgos que alcancen el umbral", () => {
    expect(evaluarAnalisis({ politicas: [base], niveles: [1, 2, 2], cobertura: null, pruebasFallidas: 0, pruebasEjecutadas: true }))
      .toEqual({ resultado: "APROBADO", motivos: [] })
  })

  it("bloquea por hallazgos de severidad igual o mayor a la política", () => {
    const r = evaluarAnalisis({ politicas: [base], niveles: [3, 4, 1], cobertura: null, pruebasFallidas: 0, pruebasEjecutadas: true })
    expect(r.resultado).toBe("BLOQUEADO")
    expect(r.motivos).toEqual(["2 hallazgos de severidad Alta o superior (política «Base»)."])
  })

  it("bloquea por pruebas fallidas aunque no haya políticas", () => {
    const r = evaluarAnalisis({ politicas: [], niveles: [], cobertura: null, pruebasFallidas: 1, pruebasEjecutadas: true })
    expect(r).toEqual({ resultado: "BLOQUEADO", motivos: ["1 prueba fallida."] })
  })

  it("bloquea por cobertura bajo el mínimo, pero no si no se midió", () => {
    const p = { ...base, coberturaMinima: 70 }
    expect(evaluarAnalisis({ politicas: [p], niveles: [], cobertura: 65.5, pruebasFallidas: 0, pruebasEjecutadas: true }).motivos)
      .toEqual(["Cobertura 65,5 % bajo el mínimo de 70 % (política «Base»)."])
    expect(evaluarAnalisis({ politicas: [p], niveles: [], cobertura: null, pruebasFallidas: 0, pruebasEjecutadas: true }).resultado).toBe("APROBADO")
    expect(evaluarAnalisis({ politicas: [p], niveles: [], cobertura: 70, pruebasFallidas: 0, pruebasEjecutadas: true }).resultado).toBe("APROBADO")
  })

  it("aplica cada política por separado", () => {
    const critica = { ...base, nombre: "Solo críticos", nivelBloqueo: 4, etiquetaBloqueo: "Crítica" }
    const r = evaluarAnalisis({ politicas: [base, critica], niveles: [3], cobertura: null, pruebasFallidas: 0, pruebasEjecutadas: true })
    expect(r.motivos).toHaveLength(1)
  })
})

describe("sin reporte de pruebas", () => {
  it("nunca aprueba: queda en ERROR aunque no haya hallazgos ni pruebas fallidas", () => {
    expect(evaluarAnalisis({ politicas: [base], niveles: [1], cobertura: null, pruebasFallidas: 0, pruebasEjecutadas: false }))
      .toEqual({ resultado: "ERROR", motivos: [MOTIVO_SIN_PRUEBAS] })
  })

  it("si además hay hallazgos que bloquean, queda BLOQUEADO y lo informa", () => {
    const r = evaluarAnalisis({ politicas: [base], niveles: [4], cobertura: null, pruebasFallidas: 0, pruebasEjecutadas: false })
    expect(r.resultado).toBe("BLOQUEADO")
    expect(r.motivos.at(-1)).toBe(MOTIVO_SIN_PRUEBAS)
  })

  it("el checklist no convierte un ERROR en aprobado ni en bloqueado", () => {
    expect(resultadoFinal("ERROR", true, false)).toEqual({ resultado: "ERROR", motivoChecklist: null })
    expect(resultadoFinal("ERROR", true, true)).toEqual({ resultado: "ERROR", motivoChecklist: null })
  })
})

describe("checklist", () => {
  it("bloquea un análisis aprobado mientras falte el checklist exigido", () => {
    expect(exigeChecklist([base, { ...base, exigeChecklistIa: true }])).toBe(true)
    expect(resultadoFinal("APROBADO", true, false)).toEqual({ resultado: "BLOQUEADO", motivoChecklist: MOTIVO_CHECKLIST })
    expect(resultadoFinal("APROBADO", true, true)).toEqual({ resultado: "APROBADO", motivoChecklist: null })
    expect(resultadoFinal("BLOQUEADO", false, false).resultado).toBe("BLOQUEADO")
  })

  it("unirMotivos recorta a 500 caracteres y devuelve null si no hay", () => {
    expect(unirMotivos([])).toBeNull()
    expect(unirMotivos(["x".repeat(600)])).toHaveLength(500)
  })
})
