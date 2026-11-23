import { z } from "zod"
import { ROLES } from "@/lib/roles"

const texto = (campo: string, max: number) =>
  z.string().trim().min(1, `${campo} es obligatorio.`).max(max, `${campo} admite hasta ${max} caracteres.`)

const usuarioGithub = z
  .string()
  .trim()
  .max(39, "El usuario de GitHub admite hasta 39 caracteres.")
  .regex(/^$|^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/, "El usuario de GitHub no es válido.")
  .transform((v) => (v === "" ? null : v))

export const esquemaPerfil = z.object({
  nombre: texto("El nombre", 60),
  apellido: texto("El apellido", 60),
  usuarioGithub,
})

export const esquemaUsuario = esquemaPerfil.extend({
  email: z.string().trim().toLowerCase().email("El correo no es válido.").max(120),
  rol: z.enum([ROLES.LIDER, ROLES.DESARROLLADOR], { message: "Elige un perfil." }),
})

export const esquemaUsuarioEdicion = esquemaPerfil.extend({
  rol: z.enum([ROLES.LIDER, ROLES.DESARROLLADOR], { message: "Elige un perfil." }),
})

export const esquemaRepositorio = z.object({
  nombre: texto("El nombre", 80),
  urlGithub: z
    .string()
    .trim()
    .max(255)
    .regex(/^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/, "Usa la URL del repositorio: https://github.com/organizacion/repositorio"),
  ramaPrincipal: z
    .string()
    .trim()
    .min(1, "La rama principal es obligatoria.")
    .max(60)
    .regex(/^[A-Za-z0-9._/-]+$/, "La rama no es válida."),
  responsableId: z.coerce.number().int().positive("Elige un responsable."),
})

export const esquemaPolitica = z.object({
  nombre: texto("El nombre", 80),
  descripcion: z.string().trim().max(255).transform((v) => v || null),
  severidadBloqueoId: z.coerce.number().int().positive("Elige la severidad de bloqueo."),
  coberturaMinima: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v.replace(",", "."))))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 100), "La cobertura debe estar entre 0 y 100."),
  exigeChecklistIa: z.boolean(),
})

/** Convierte un FormData en objeto plano; las casillas ausentes quedan como "". */
export function campos(formData: FormData, nombres: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const n of nombres) {
    const v = formData.get(n)
    out[n] = typeof v === "string" ? v : ""
  }
  return out
}

export function idValido(valor: unknown): number | null {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 && n < 2_147_483_647 ? n : null
}
