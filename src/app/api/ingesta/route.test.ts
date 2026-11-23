import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/ingesta/procesar", () => ({
  repositorioPorToken: vi.fn(),
  excedeLimite: vi.fn(),
  procesarIngesta: vi.fn(),
}))
vi.mock("@/lib/audit", () => ({ ipDesdeHeaders: () => "10.0.0.1" }))
vi.mock("next/server", () => ({ after: vi.fn() }))
vi.mock("@/lib/avisos", () => ({ avisarEscaneoEnRojo: vi.fn() }))

import { after } from "next/server"
import { avisarEscaneoEnRojo } from "@/lib/avisos"
import { excedeLimite, procesarIngesta, repositorioPorToken } from "@/lib/ingesta/procesar"
import { POST } from "./route"

const valido = {
  commitSha: "a".repeat(40), ramaOrigen: "feature/x", numeroPr: 3, autorGithub: "dsoto",
  herramientasEjecutadas: ["gitleaks"], pruebasFallidas: 0, cobertura: null,
  hallazgos: [{ herramienta: "gitleaks", categoria: "Secreto expuesto", severidad: "Crítica", titulo: "Clave", huella: "b".repeat(64) }],
}

function req(body: unknown, token: string | null = "pgr_token") {
  return new Request("http://guard.test/api/ingesta", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.mocked(repositorioPorToken).mockReset().mockResolvedValue({ id: 1, ramaPrincipal: "main" })
  vi.mocked(excedeLimite).mockReset().mockResolvedValue(false)
  vi.mocked(procesarIngesta).mockReset().mockResolvedValue({
    escaneoId: 5, resultado: "BLOQUEADO", motivos: ["x"], hallazgosNuevos: 1, hallazgosExistentes: 0, hallazgosResueltos: 0, url: "http://guard.test/escaneos/5",
  })
})

describe("POST /api/ingesta", () => {
  it("401 sin token o con token inválido/revocado", async () => {
    expect((await POST(req(valido, null))).status).toBe(401)
    vi.mocked(repositorioPorToken).mockResolvedValue(null)
    expect((await POST(req(valido))).status).toBe(401)
    expect(procesarIngesta).not.toHaveBeenCalled()
  })

  it("429 al superar 60 solicitudes por minuto", async () => {
    vi.mocked(excedeLimite).mockResolvedValue(true)
    const res = await POST(req(valido))
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("60")
  })

  it("400 con JSON inválido o datos fuera del esquema", async () => {
    expect((await POST(req("{no es json"))).status).toBe(400)
    expect((await POST(req({ ...valido, commitSha: "corto" }))).status).toBe(400)
    expect((await POST(req({ ...valido, hallazgos: [{ ...valido.hallazgos[0], huella: "x" }] }))).status).toBe(400)
    expect((await POST(req({ ...valido, urlEjecucion: "http://inseguro.test" }))).status).toBe(400)
  })

  it("201 con el resultado del quality gate", async () => {
    const res = await POST(req(valido))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ escaneoId: 5, resultado: "BLOQUEADO" })
    expect(vi.mocked(procesarIngesta).mock.calls[0][2]).toBe("10.0.0.1")
  })

  it("el aviso a Slack corre después de responder, con la hora de recepción", async () => {
    vi.mocked(after).mockClear()
    await POST(req(valido))
    expect(after).toHaveBeenCalledTimes(1)
    await (vi.mocked(after).mock.calls[0][0] as () => Promise<unknown>)()
    const recibido = vi.mocked(procesarIngesta).mock.calls[0][3]
    expect(avisarEscaneoEnRojo).toHaveBeenCalledWith(5, recibido)
  })

  it("500 sin detalles internos si falla el registro", async () => {
    vi.mocked(procesarIngesta).mockRejectedValue(new Error("connection refused at 10.0.0.5"))
    const res = await POST(req(valido))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain("10.0.0.5")
  })
})
