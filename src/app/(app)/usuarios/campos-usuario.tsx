import { ETIQUETA_ROL, ROLES } from "@/lib/roles"

type Valores = { nombre?: string; apellido?: string; email?: string; rol?: string; usuarioGithub?: string | null }

export function CamposUsuario({ v = {}, conEmail }: { v?: Valores; conEmail: boolean }) {
  return (
    <>
      <div className="form-row">
        <div className="field">
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" className="input" required maxLength={60} defaultValue={v.nombre} />
        </div>
        <div className="field">
          <label htmlFor="apellido">Apellido</label>
          <input id="apellido" name="apellido" className="input" required maxLength={60} defaultValue={v.apellido} />
        </div>
      </div>
      {conEmail && (
        <div className="field">
          <label htmlFor="email">Correo corporativo</label>
          <input id="email" name="email" type="email" className="input" required maxLength={120} defaultValue={v.email} placeholder="nombre@postedin.com" />
          <span className="hint">Recibirá un enlace para definir su contraseña (válido 48 horas).</span>
        </div>
      )}
      <div className="form-row">
        <div className="field">
          <label htmlFor="rol">Perfil</label>
          <select id="rol" name="rol" className="input" required defaultValue={v.rol ?? ROLES.DESARROLLADOR}>
            <option value={ROLES.DESARROLLADOR}>{ETIQUETA_ROL.DESARROLLADOR}</option>
            <option value={ROLES.LIDER}>{ETIQUETA_ROL.LIDER_TECNICO}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="usuarioGithub">Usuario de GitHub <span className="muted">(opcional)</span></label>
          <input id="usuarioGithub" name="usuarioGithub" className="input" maxLength={39} defaultValue={v.usuarioGithub ?? ""} />
        </div>
      </div>
    </>
  )
}
