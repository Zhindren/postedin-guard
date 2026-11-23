import Link from "next/link"
import { requireUser } from "@/lib/auth/guards"

export const metadata = { title: "Sin permiso" }

export default async function SinPermisoPage() {
  await requireUser()
  return (
    <div className="card stack" style={{ maxWidth: 560 }}>
      <h1>No tienes permiso para ver esta sección</h1>
      <p className="muted">Esta sección es solo para el perfil Líder Técnico. Si crees que es un error, habla con la jefatura técnica.</p>
      <div><Link className="btn btn-light" href="/">Volver al dashboard</Link></div>
    </div>
  )
}
