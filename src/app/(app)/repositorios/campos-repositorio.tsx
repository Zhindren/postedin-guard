type Valores = { nombre?: string; urlGithub?: string; ramaPrincipal?: string; responsableId?: number }
type Persona = { id: number; nombre: string; apellido: string }

export function CamposRepositorio({ v = {}, personas }: { v?: Valores; personas: Persona[] }) {
  return (
    <>
      <div className="field">
        <label htmlFor="nombre">Nombre</label>
        <input id="nombre" name="nombre" className="input" required maxLength={80} defaultValue={v.nombre} placeholder="portal-interno" />
      </div>
      <div className="field">
        <label htmlFor="urlGithub">URL en GitHub</label>
        <input id="urlGithub" name="urlGithub" className="input" required maxLength={255} defaultValue={v.urlGithub}
          placeholder="https://github.com/organizacion/repositorio" />
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="ramaPrincipal">Rama principal</label>
          <input id="ramaPrincipal" name="ramaPrincipal" className="input" required maxLength={60} defaultValue={v.ramaPrincipal ?? "main"} />
        </div>
        <div className="field">
          <label htmlFor="responsableId">Responsable técnico</label>
          <select id="responsableId" name="responsableId" className="input" required defaultValue={v.responsableId ?? ""}>
            <option value="" disabled>Elige una persona</option>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
          </select>
        </div>
      </div>
    </>
  )
}
