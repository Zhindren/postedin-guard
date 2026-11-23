const fechaHora = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago",
})
const fecha = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Santiago" })

export function fmtFechaHora(d: Date | null | undefined): string {
  return d ? fechaHora.format(d) : "—"
}

export function fmtFecha(d: Date | null | undefined): string {
  return d ? fecha.format(d) : "—"
}

export function fmtPorcentaje(n: number | null | undefined, decimales = 0): string {
  return n === null || n === undefined || !Number.isFinite(n) ? "—" : `${n.toFixed(decimales).replace(".", ",")} %`
}

export function shaCorto(sha: string): string {
  return sha.slice(0, 7)
}

export function iniciales(nombre: string): string {
  return nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase()
}
