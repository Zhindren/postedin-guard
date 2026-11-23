import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Postedin Guard", template: "%s · Postedin Guard" },
  description: "Seguridad y calidad en cada cambio del equipo de desarrollo de Postedin.",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
