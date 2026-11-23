const SEPARADOR = ";"

/**
 * Una celda que empieza con = + - @ o un tabulador la interpreta Excel como fórmula: se
 * antepone un apóstrofo para que se muestre como texto (inyección de fórmulas en CSV).
 */
export function celdaCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return ""
  let s = valor instanceof Date ? valor.toISOString() : String(valor)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[";\n\r]/.test(s) || s.includes(SEPARADOR)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

/** CSV con BOM y separador «;», que es lo que espera Excel con configuración regional de Chile. */
export function aCsv<T>(filas: T[], columnas: { titulo: string; valor: (f: T) => unknown }[]): string {
  const lineas = [columnas.map((c) => celdaCsv(c.titulo)).join(SEPARADOR)]
  for (const f of filas) lineas.push(columnas.map((c) => celdaCsv(c.valor(f))).join(SEPARADOR))
  return "﻿" + lineas.join("\r\n") + "\r\n"
}
