import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "@/test/prisma"

vi.mock("@/lib/db", async () => (await import("@/test/prisma")).prismaModule)
vi.mock("@/lib/mail", () => ({ enviarCorreo: vi.fn() }))

import { enviarCorreo } from "@/lib/mail"
import { avisarAsignacion, avisarEscaneoEnRojo, mensajeSlack, requiereAlarma, slackConfigurado, type ResumenEscaneo } from "./avisos"

const fetchMock = vi.fn()
const desde = new Date("2026-11-16T12:00:00Z")

const base: ResumenEscaneo = {
  escaneoId: 9, repositorio: "portal-demo", rama: "feature/x", numeroPr: 12, commitSha: "abcdef1".padEnd(40, "0"),
  resultado: "BLOQUEADO", motivo: "1 hallazgo de severidad Alta o superior.", criticosNuevos: 0, previoBloqueado: false,
}

beforeEach(() => {
  resetPrismaMock()
  vi.mocked(enviarCorreo).mockReset().mockResolvedValue(true)
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
  vi.stubGlobal("fetch", fetchMock)
  process.env.SLACK_BOT_TOKEN = "xoxb-test"
  process.env.GUARD_SLACK_CHANNEL = "#guard-alertas"
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.SLACK_BOT_TOKEN
  delete process.env.GUARD_SLACK_CHANNEL
})

describe("correo de asignación", () => {
  const hallazgo = {
    titulo: "Clave expuesta", rutaArchivo: "src/x.ts", linea: 7,
    severidad: { nombre: "Crítica" }, escaneo: { repositorio: { nombre: "portal-demo" } },
  }

  it("avisa al responsable con el enlace al hallazgo", async () => {
    prismaMock.hallazgo.findUnique.mockResolvedValue(hallazgo)
    prismaMock.usuario.findUnique.mockResolvedValue({ email: "d@postedin.com", nombre: "Dani", activo: true })
    expect(await avisarAsignacion(5, 2)).toBe(true)
    const correo = vi.mocked(enviarCorreo).mock.calls[0][0]
    expect(correo.para).toBe("d@postedin.com")
    expect(correo.asunto).toContain("Crítica")
    expect(correo.texto).toContain("src/x.ts:7")
    expect(correo.texto).toContain("http://guard.test/hallazgos/5")
  })

  it("no avisa a una cuenta desactivada", async () => {
    prismaMock.hallazgo.findUnique.mockResolvedValue(hallazgo)
    prismaMock.usuario.findUnique.mockResolvedValue({ email: "d@postedin.com", nombre: "Dani", activo: false })
    expect(await avisarAsignacion(5, 2)).toBe(false)
    expect(enviarCorreo).not.toHaveBeenCalled()
  })

  it("un error nunca se propaga: la asignación ya quedó hecha", async () => {
    prismaMock.hallazgo.findUnique.mockRejectedValue(new Error("db caída"))
    prismaMock.usuario.findUnique.mockResolvedValue(null)
    await expect(avisarAsignacion(5, 2)).resolves.toBe(false)
  })
})

describe("alarma de Slack", () => {
  it("queda apagada sin token o sin canal", () => {
    expect(slackConfigurado({ SLACK_BOT_TOKEN: "xoxb-1" })).toBeNull()
    expect(slackConfigurado({ GUARD_SLACK_CHANNEL: "#c" })).toBeNull()
    expect(slackConfigurado({ SLACK_BOT_TOKEN: " xoxb-1 ", GUARD_SLACK_CHANNEL: "#c" })).toEqual({ token: "xoxb-1", canal: "#c" })
  })

  it("solo suena por críticos nuevos o cuando una rama pasa a BLOQUEADO", () => {
    expect(requiereAlarma(base)).toBe(true)
    expect(requiereAlarma({ ...base, previoBloqueado: true })).toBe(false)
    expect(requiereAlarma({ ...base, previoBloqueado: true, criticosNuevos: 1 })).toBe(true)
    expect(requiereAlarma({ ...base, resultado: "APROBADO" })).toBe(false)
    expect(requiereAlarma({ ...base, resultado: "ERROR" })).toBe(false)
  })

  it("el mensaje aclara que no detiene nada", () => {
    const m = mensajeSlack({ ...base, criticosNuevos: 2 }, "http://guard.test/escaneos/9")
    expect(m).toContain("PR #12")
    expect(m).toContain("2 hallazgos críticos nuevos")
    expect(m).toContain("no detiene el PR ni el deploy")
  })

  function escaneo(resultado: string, previo: string | null, criticos = 0) {
    prismaMock.escaneo.findUnique.mockResolvedValue({
      repositorioId: 1, ramaOrigen: "feature/x", numeroPr: 12, commitSha: base.commitSha, resultado, motivo: base.motivo,
      repositorio: { nombre: "portal-demo" },
    })
    prismaMock.escaneo.findFirst.mockResolvedValue(previo ? { resultado: previo } : null)
    prismaMock.hallazgo.count.mockResolvedValue(criticos)
  }

  it("postea al canal configurado cuando el análisis queda en rojo", async () => {
    escaneo("BLOQUEADO", "APROBADO")
    expect(await avisarEscaneoEnRojo(9, desde)).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://slack.com/api/chat.postMessage")
    expect(init.headers.Authorization).toBe("Bearer xoxb-test")
    expect(JSON.parse(init.body).channel).toBe("#guard-alertas")
    expect(prismaMock.hallazgo.count.mock.calls[0][0].where).toMatchObject({ escaneoId: 9, fechaDeteccion: { gte: desde } })
  })

  it("no repite el aviso si la rama ya estaba bloqueada y no hay críticos nuevos", async () => {
    escaneo("BLOQUEADO", "BLOQUEADO")
    expect(await avisarEscaneoEnRojo(9, desde)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("sin configuración no consulta nada ni llama a Slack", async () => {
    delete process.env.SLACK_BOT_TOKEN
    expect(await avisarEscaneoEnRojo(9, desde)).toBe(false)
    expect(prismaMock.escaneo.findUnique).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("un fallo de Slack se registra y no se propaga", async () => {
    escaneo("BLOQUEADO", null)
    fetchMock.mockRejectedValue(new Error("timeout"))
    await expect(avisarEscaneoEnRojo(9, desde)).resolves.toBe(false)
  })
})
