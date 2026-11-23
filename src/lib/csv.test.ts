import { describe, expect, it } from "vitest"
import { aCsv, celdaCsv } from "./csv"

describe("CSV", () => {
  it("neutraliza fórmulas", () => {
    expect(celdaCsv("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`)
    expect(celdaCsv("+1")).toBe("'+1")
    expect(celdaCsv("-2")).toBe("'-2")
    expect(celdaCsv("@cmd")).toBe("'@cmd")
  })

  it("escapa separador, comillas y saltos de línea", () => {
    expect(celdaCsv("a;b")).toBe('"a;b"')
    expect(celdaCsv('dice "hola"')).toBe('"dice ""hola"""')
    expect(celdaCsv("línea\notra")).toBe('"línea\notra"')
    expect(celdaCsv(null)).toBe("")
    expect(celdaCsv(12)).toBe("12")
  })

  it("arma el archivo con BOM, encabezado y CRLF", () => {
    const csv = aCsv([{ a: 1, b: "x" }], [{ titulo: "A", valor: (f) => f.a }, { titulo: "B", valor: (f) => f.b }])
    expect(csv).toBe("﻿A;B\r\n1;x\r\n")
  })
})
