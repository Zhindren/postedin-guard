import Link from "next/link"
import { notFound } from "next/navigation"
import { FormAccion } from "@/components/form-accion"
import { requireLider } from "@/lib/auth/guards"
import { prisma } from "@/lib/db"
import { fmtFechaHora } from "@/lib/formato"
import { idValido } from "@/lib/validacion"
import { editarUsuarioAction, reenviarInvitacionAction } from "../actions"
import { CamposUsuario } from "../campos-usuario"

export const metadata = { title: "Editar usuario" }

export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireLider()
  const id = idValido((await params).id)
  if (!id) notFound()
  const u = await prisma.usuario.findUnique({ where: { id }, include: { rol: true } })
  if (!u) notFound()
  return (
    <>
      <div className="page-head">
        <div>
          <div className="breadcrumb"><Link href="/usuarios">Usuarios</Link> / {u.nombre} {u.apellido}</div>
          <h1>{u.nombre} {u.apellido}</h1>
          <p>{u.email} · creada el {fmtFechaHora(u.fechaCreacion)}</p>
        </div>
      </div>
      <div className="grid grid-2">
        <section className="card">
          <h2>Datos y perfil</h2>
          <FormAccion action={editarUsuarioAction.bind(null, u.id)} boton="Guardar cambios">
            <CamposUsuario v={{ ...u, rol: u.rol.nombre }} conEmail={false} />
          </FormAccion>
        </section>
        <section className="card stack">
          <h2>Acceso</h2>
          <dl className="meta">
            <dt>Estado</dt><dd>{u.activo ? "Activa" : "Inactiva"}</dd>
            <dt>Último acceso</dt><dd>{fmtFechaHora(u.ultimoAcceso)}</dd>
          </dl>
          <p className="muted" style={{ margin: 0 }}>Si la persona no alcanzó a activar su cuenta, puedes enviarle un enlace nuevo.</p>
          <FormAccion action={reenviarInvitacionAction.bind(null, u.id)} boton="Reenviar invitación" variante="light" pendiente="Enviando…" />
        </section>
      </div>
    </>
  )
}
