import { describe, expect, it } from "vitest"
import { hashPassword, hashSeñuelo, validarPassword, verificarPassword } from "./password"

describe("validarPassword", () => {
  it("exige 12 caracteres, letras y números", () => {
    expect(validarPassword("corta1")).toMatch(/12/)
    expect(validarPassword("solamenteletras")).toMatch(/letras y números/)
    expect(validarPassword("123456789012")).toMatch(/letras y números/)
    expect(validarPassword("unaClaveSegura2026")).toBeNull()
  })

  it("rechaza claves de más de 72 bytes, que bcrypt truncaría", () => {
    expect(validarPassword("a1".repeat(37))).toMatch(/larga/)
  })
})

describe("hash de contraseñas", () => {
  it("verifica la clave correcta y rechaza otra", async () => {
    const hash = await hashPassword("unaClaveSegura2026")
    expect(hash).not.toContain("unaClaveSegura2026")
    expect(await verificarPassword("unaClaveSegura2026", hash)).toBe(true)
    expect(await verificarPassword("otraClave2026xx", hash)).toBe(false)
  })

  it("el señuelo es un hash válido que no coincide con nada conocido", async () => {
    expect(await verificarPassword("", await hashSeñuelo())).toBe(false)
  })
})
