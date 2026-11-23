import { z } from "zod"

export const MAX_HALLAZGOS = 2000
export const HERRAMIENTAS = ["gitleaks", "npm audit", "Semgrep", "Vitest"] as const
export const SEVERIDADES = ["Crítica", "Alta", "Media", "Baja"] as const

const opcional = (max: number) =>
  z.string().max(5000).nullish().transform((v) => (v ? v.slice(0, max) : null))

export const esquemaHallazgo = z.object({
  herramienta: z.enum(HERRAMIENTAS),
  categoria: z.string().min(1).max(60),
  severidad: z.enum(SEVERIDADES),
  titulo: z.string().trim().min(1).max(500).transform((v) => v.slice(0, 150)),
  descripcion: opcional(2000),
  rutaArchivo: opcional(255),
  linea: z.number().int().positive().max(10_000_000).nullish().transform((v) => v ?? null),
  regla: opcional(120),
  huella: z.string().regex(/^[0-9a-f]{64}$/, "huella inválida"),
})

export const esquemaIngesta = z.object({
  commitSha: z.string().regex(/^[0-9a-f]{40}$/, "commitSha debe ser un SHA de 40 caracteres en minúsculas"),
  ramaOrigen: z.string().trim().min(1).max(120),
  numeroPr: z.number().int().positive().nullish().transform((v) => v ?? null),
  autorGithub: z.string().trim().min(1).max(40),
  urlEjecucion: z
    .string()
    .url()
    .max(255)
    .refine((u) => u.startsWith("https://"), "urlEjecucion debe ser https")
    .nullish()
    .transform((v) => v ?? null),
  herramientasEjecutadas: z.array(z.enum(HERRAMIENTAS)).max(HERRAMIENTAS.length).default([]),
  pruebasFallidas: z.number().int().min(0).max(1_000_000).default(0),
  pruebasTotales: z.number().int().min(0).nullish(),
  cobertura: z.number().min(0).max(100).nullish().transform((v) => (v === undefined ? null : v)),
  hallazgos: z.array(esquemaHallazgo).max(MAX_HALLAZGOS, `Se aceptan hasta ${MAX_HALLAZGOS} hallazgos por análisis`),
})

export type PayloadIngesta = z.infer<typeof esquemaIngesta>
export type HallazgoIngesta = z.infer<typeof esquemaHallazgo>
