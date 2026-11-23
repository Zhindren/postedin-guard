import { beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "@/test/prisma"

vi.mock("@/lib/db", async () => (await import("@/test/prisma")).prismaModule)
vi.mock("@/lib/audit", () => ({ registrarEvento: vi.fn(), ipDesdeHeaders: () => null }))
vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }))

import { auth } from "@/lib/auth/config"
import { GET } from "./route"

const sesion = (rol: string) => ({ user: { uid: 1, email: "x@postedin.com", name: "X", rol } })
const req = () => new Request("http://guard.test/api/hallazgos/export?estado=PENDIENTES")

beforeEach(() => {
  resetPrismaMock()
  prismaMock.hallazgo.findMany.mockResolvedValue([{
    id: 7, titulo: "=cmd()", rutaArchivo: "a.ts", linea: 3, regla: "r", estado: "ABIERTO", fechaDeteccion: new Date("2026-11-01T00:00:00Z"),
    fechaCierre: null, severidad: { nombre: "Alta", plazoDias: 7 }, categoria: { nombre: "Código inseguro" }, herramienta: { nombre: "Semgrep" },
    asignado: null, escaneo: { numeroPr: 4, commitSha: "a".repeat(40), repositorio: { nombre: "portal" } },
  }])
})

describe("GET /api/hallazgos/export", () => {
  it("401 sin sesión y 403 para el Desarrollador", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    expect((await GET(req())).status).toBe(401)
    vi.mocked(auth).mockResolvedValue(sesion("DESARROLLADOR") as never)
    expect((await GET(req())).status).toBe(403)
    expect(prismaMock.hallazgo.findMany).not.toHaveBeenCalled()
  })

  it("el Líder descarga el CSV filtrado y sin fórmulas ejecutables", async () => {
    vi.mocked(auth).mockResolvedValue(sesion("LIDER_TECNICO") as never)
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toContain("text/csv")
    const texto = await res.text()
    expect(texto).toContain("H-0007;portal;Alta")
    expect(texto).toContain("'=cmd()")
    expect(texto).toContain("2026-11-08")
    expect(prismaMock.hallazgo.findMany.mock.calls[0][0].where).toEqual({ AND: [{ estado: { in: ["ABIERTO", "EN_PROGRESO"] } }] })
  })
})
