export function dominiosPermitidos(): string[] {
  return (process.env.GUARD_ALLOWED_EMAIL_DOMAINS ?? "postedin.com")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
}

export function urlPublica(): string {
  return (process.env.GUARD_PUBLIC_URL ?? "http://localhost:3100").replace(/\/+$/, "")
}

export function esProduccion(): boolean {
  return process.env.NODE_ENV === "production"
}

/** Despliegue de demostración (GUARD_DEMO=1): datos ficticios y cuentas de prueba protegidas. */
export function modoDemo(): boolean {
  return process.env.GUARD_DEMO === "1"
}

/** En la demo, las cuentas @demo.test no se pueden desactivar, editar ni cambiar de clave. */
export function cuentaDemoProtegida(email: string): boolean {
  return modoDemo() && email.toLowerCase().endsWith("@demo.test")
}

export const MENSAJE_CUENTA_DEMO = "En la demostración las cuentas de prueba no se pueden modificar. Crea una cuenta nueva para probarlo."
