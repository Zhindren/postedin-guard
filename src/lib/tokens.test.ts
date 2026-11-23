import { describe, expect, it } from "vitest"
import { extraerBearer, generarToken, igualSeguro, sha256Hex } from "./tokens"

describe("tokens", () => {
  it("genera tokens distintos con prefijo", () => {
    const a = generarToken("pg_")
    expect(a.startsWith("pg_")).toBe(true)
    expect(a.length).toBeGreaterThan(40)
    expect(generarToken("pg_")).not.toBe(a)
  })

  it("sha256Hex devuelve 64 caracteres hex", () => {
    expect(sha256Hex("hola")).toMatch(/^[0-9a-f]{64}$/)
  })

  it("igualSeguro compara aunque el largo difiera", () => {
    expect(igualSeguro("abc", "abc")).toBe(true)
    expect(igualSeguro("abc", "abcd")).toBe(false)
  })

  it("extraerBearer solo acepta el formato Bearer", () => {
    expect(extraerBearer("Bearer pg_123")).toBe("pg_123")
    expect(extraerBearer("bearer pg_123")).toBe("pg_123")
    expect(extraerBearer("Basic xyz")).toBeNull()
    expect(extraerBearer(null)).toBeNull()
    expect(extraerBearer("Bearer a b")).toBeNull()
  })
})
