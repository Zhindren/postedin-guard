import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/config"

const PUBLICAS = ["/login", "/recuperar", "/restablecer"]

// El proxy solo redirige; la autorización real se valida en cada página, acción y handler.
// Pasar por aquí en cada navegación también renueva la marca de actividad de la sesión.
export default auth((req) => {
  const { pathname } = req.nextUrl
  const publica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (!req.auth && !publica) {
    if (pathname.startsWith("/api/")) return Response.json({ error: "No autenticado" }, { status: 401 })
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }
  if (req.auth && pathname === "/login") return NextResponse.redirect(new URL("/", req.nextUrl))
  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api/ingesta|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico)$).*)"],
}
