import { FormAccion } from "@/components/form-accion"
import { requireUser } from "@/lib/auth/guards"
import { prisma } from "@/lib/db"
import { ETIQUETA_ROL } from "@/lib/roles"
import { actualizarPerfilAction, cambiarPasswordAction } from "./actions"

export const metadata = { title: "Mi perfil" }

export default async function PerfilPage() {
  const s = await requireUser()
  const u = await prisma.usuario.findUniqueOrThrow({ where: { id: s.id } })
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mi perfil</h1>
          <p>{u.email} · {ETIQUETA_ROL[s.rol]}</p>
        </div>
      </div>
      <div className="grid grid-2-even">
        <section className="card">
          <h2>Datos personales</h2>
          <FormAccion action={actualizarPerfilAction} boton="Guardar datos">
            <div className="form-row">
              <div className="field">
                <label htmlFor="nombre">Nombre</label>
                <input id="nombre" name="nombre" className="input" required maxLength={60} defaultValue={u.nombre} />
              </div>
              <div className="field">
                <label htmlFor="apellido">Apellido</label>
                <input id="apellido" name="apellido" className="input" required maxLength={60} defaultValue={u.apellido} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="usuarioGithub">Usuario de GitHub</label>
              <input id="usuarioGithub" name="usuarioGithub" className="input" maxLength={39} defaultValue={u.usuarioGithub ?? ""} />
              <span className="hint">Se usa para asociar los análisis de tus pull requests.</span>
            </div>
          </FormAccion>
        </section>
        <section className="card">
          <h2>Cambiar contraseña</h2>
          <FormAccion action={cambiarPasswordAction} boton="Cambiar contraseña">
            <div className="field">
              <label htmlFor="actual">Contraseña actual</label>
              <input id="actual" name="actual" type="password" className="input" required autoComplete="current-password" />
            </div>
            <div className="field">
              <label htmlFor="nueva">Nueva contraseña</label>
              <input id="nueva" name="nueva" type="password" className="input" required minLength={12} autoComplete="new-password" />
              <span className="hint">Mínimo 12 caracteres, con letras y números. Se cerrarán todas tus sesiones.</span>
            </div>
            <div className="field">
              <label htmlFor="confirmacion">Repite la nueva contraseña</label>
              <input id="confirmacion" name="confirmacion" type="password" className="input" required minLength={12} autoComplete="new-password" />
            </div>
          </FormAccion>
        </section>
      </div>
    </>
  )
}
