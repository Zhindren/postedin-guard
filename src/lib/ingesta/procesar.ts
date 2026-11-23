import { prisma } from "@/lib/db"
import { registrarEvento } from "@/lib/audit"
import { urlPublica } from "@/lib/env"
import { sha256Hex } from "@/lib/tokens"
import { evaluarAnalisis, exigeChecklist, resultadoFinal, unirMotivos, type PoliticaGate } from "@/lib/gate"
import { checklistCompleto } from "@/lib/checklist"
import type { PayloadIngesta } from "./esquema"

export const LIMITE_POR_MINUTO = 60

export type RepoAutenticado = { id: number; ramaPrincipal: string }

export async function repositorioPorToken(token: string): Promise<RepoAutenticado | null> {
  if (!token.startsWith("pgr_") || token.length > 100) return null
  // Se busca por el hash: el token en claro nunca se compara ni se guarda.
  const repo = await prisma.repositorio.findUnique({
    where: { tokenHash: sha256Hex(token) },
    select: { id: true, activo: true, ramaPrincipal: true },
  })
  return repo?.activo ? { id: repo.id, ramaPrincipal: repo.ramaPrincipal } : null
}

export async function excedeLimite(repoId: number, ahora = new Date()): Promise<boolean> {
  const n = await prisma.bitacoraAuditoria.count({
    where: { accion: "ESCANEO_RECIBIDO", entidad: "repositorio", entidadId: repoId, fechaEvento: { gt: new Date(ahora.getTime() - 60_000) } },
  })
  return n >= LIMITE_POR_MINUTO
}

export async function politicasDelRepositorio(repoId: number): Promise<PoliticaGate[]> {
  const filas = await prisma.repositorioPolitica.findMany({
    where: { repositorioId: repoId, politica: { activa: true } },
    include: { politica: { include: { severidadBloqueo: true } } },
  })
  return filas.map(({ politica: p }) => ({
    nombre: p.nombre,
    nivelBloqueo: p.severidadBloqueo.nivel,
    etiquetaBloqueo: p.severidadBloqueo.nombre,
    coberturaMinima: p.coberturaMinima === null ? null : Number(p.coberturaMinima),
    exigeChecklistIa: p.exigeChecklistIa,
  }))
}

export type RespuestaIngesta = {
  escaneoId: number
  resultado: "APROBADO" | "BLOQUEADO" | "ERROR"
  motivos: string[]
  hallazgosNuevos: number
  hallazgosExistentes: number
  hallazgosResueltos: number
  url: string
}

type Catalogos = {
  categorias: Map<string, number>
  severidades: Map<string, { id: number; nivel: number }>
  herramientas: Map<string, number>
}

async function cargarCatalogos(): Promise<Catalogos> {
  const [cats, sevs, herrs] = await Promise.all([
    prisma.categoriaHallazgo.findMany(),
    prisma.severidad.findMany(),
    prisma.herramienta.findMany(),
  ])
  return {
    categorias: new Map(cats.map((c) => [c.nombre, c.id])),
    severidades: new Map(sevs.map((s) => [s.nombre, { id: s.id, nivel: s.nivel }])),
    herramientas: new Map(herrs.map((h) => [h.nombre, h.id])),
  }
}

/**
 * Registra el análisis de un commit. Un hallazgo que ya existe en el repositorio (misma huella)
 * no se duplica: se reabre si estaba resuelto. Solo un análisis de la rama principal da por
 * resueltos los hallazgos que ya no aparecen, y solo los de herramientas que sí corrieron.
 */
export async function procesarIngesta(repo: RepoAutenticado, p: PayloadIngesta, ip: string | null, ahora = new Date()): Promise<RespuestaIngesta> {
  const cat = await cargarCatalogos()
  const otraCategoria = cat.categorias.get("Código inseguro")!
  const huellas = p.hallazgos.map((h) => h.huella)
  const politicas = await politicasDelRepositorio(repo.id)

  const resultado = await prisma.$transaction(async (tx) => {
    const existentes = huellas.length === 0 ? [] : await tx.hallazgo.findMany({
      where: { huella: { in: huellas }, escaneo: { repositorioId: repo.id } },
      select: { id: true, huella: true, estado: true },
    })
    const porHuella = new Map(existentes.map((h) => [h.huella, h]))

    const datosEscaneo = {
      numeroPr: p.numeroPr,
      ramaOrigen: p.ramaOrigen,
      autorGithub: p.autorGithub,
      coberturaPruebas: p.cobertura,
      pruebasFallidas: p.pruebasFallidas,
      urlEjecucion: p.urlEjecucion,
      totalHallazgos: p.hallazgos.length,
      fechaEjecucion: ahora,
    }
    const escaneo = await tx.escaneo.upsert({
      where: { repositorioId_commitSha: { repositorioId: repo.id, commitSha: p.commitSha } },
      update: datosEscaneo,
      create: { ...datosEscaneo, repositorioId: repo.id, commitSha: p.commitSha, resultado: "ERROR", resultadoAnalisis: "ERROR" },
    })

    const nuevos = p.hallazgos.filter((h) => !porHuella.has(h.huella))
    if (nuevos.length > 0) {
      await tx.hallazgo.createMany({
        data: nuevos.map((h) => ({
          escaneoId: escaneo.id,
          categoriaId: cat.categorias.get(h.categoria) ?? otraCategoria,
          severidadId: cat.severidades.get(h.severidad)!.id,
          herramientaId: cat.herramientas.get(h.herramienta)!,
          titulo: h.titulo,
          descripcion: h.descripcion,
          rutaArchivo: h.rutaArchivo,
          linea: h.linea,
          regla: h.regla,
          huella: h.huella,
          fechaDeteccion: ahora,
        })),
      })
    }
    // Registra todos los hallazgos presentes en este análisis (nuevos y existentes). Si el mismo
    // commit se reenvía, la lista se reemplaza por la del último envío.
    const presentes = huellas.length === 0 ? [] : await tx.hallazgo.findMany({
      where: { huella: { in: huellas }, escaneo: { repositorioId: repo.id } },
      select: { id: true },
    })
    const idsPresentes = presentes.map((h) => h.id)
    await tx.deteccion.deleteMany({ where: { escaneoId: escaneo.id, hallazgoId: { notIn: idsPresentes } } })
    if (idsPresentes.length > 0) {
      await tx.deteccion.createMany({
        data: idsPresentes.map((hallazgoId) => ({ escaneoId: escaneo.id, hallazgoId })),
        skipDuplicates: true,
      })
    }

    const reabrir = existentes.filter((h) => h.estado === "RESUELTO").map((h) => h.id)
    if (reabrir.length > 0) {
      await tx.hallazgo.updateMany({ where: { id: { in: reabrir } }, data: { estado: "ABIERTO", fechaCierre: null } })
    }

    let resueltos = 0
    const esRamaPrincipal = p.numeroPr === null && p.ramaOrigen === repo.ramaPrincipal
    if (esRamaPrincipal && p.herramientasEjecutadas.length > 0) {
      const ids = p.herramientasEjecutadas.map((n) => cat.herramientas.get(n)).filter((x): x is number => x !== undefined)
      const r = await tx.hallazgo.updateMany({
        where: {
          escaneo: { repositorioId: repo.id },
          estado: { in: ["ABIERTO", "EN_PROGRESO"] },
          herramientaId: { in: ids },
          huella: { notIn: huellas },
        },
        data: { estado: "RESUELTO", fechaCierre: ahora },
      })
      resueltos = r.count
    }

    const falsosPositivos = new Set(existentes.filter((h) => h.estado === "FALSO_POSITIVO").map((h) => h.huella))
    const niveles = p.hallazgos.filter((h) => !falsosPositivos.has(h.huella)).map((h) => cat.severidades.get(h.severidad)!.nivel)
    const analisis = evaluarAnalisis({
      politicas,
      niveles,
      cobertura: p.cobertura,
      pruebasFallidas: p.pruebasFallidas,
      pruebasEjecutadas: p.herramientasEjecutadas.includes("Vitest"),
    })
    const completo = await checklistCompleto(escaneo.id, tx)
    const final = resultadoFinal(analisis.resultado, exigeChecklist(politicas), completo)
    const motivos = final.motivoChecklist ? [...analisis.motivos, final.motivoChecklist] : analisis.motivos

    await tx.escaneo.update({
      where: { id: escaneo.id },
      data: { resultadoAnalisis: analisis.resultado, resultado: final.resultado, motivo: unirMotivos(analisis.motivos) },
    })
    return { escaneoId: escaneo.id, resultado: final.resultado, motivos, nuevos: nuevos.length, existentes: existentes.length, resueltos }
  })

  await registrarEvento({
    accion: "ESCANEO_RECIBIDO",
    entidad: "repositorio",
    entidadId: repo.id,
    detalle: `escaneo ${resultado.escaneoId}: ${resultado.resultado}, ${resultado.nuevos} nuevos`,
    ip,
  })
  return {
    escaneoId: resultado.escaneoId,
    resultado: resultado.resultado,
    motivos: resultado.motivos,
    hallazgosNuevos: resultado.nuevos,
    hallazgosExistentes: resultado.existentes,
    hallazgosResueltos: resultado.resueltos,
    url: `${urlPublica()}/escaneos/${resultado.escaneoId}`,
  }
}
