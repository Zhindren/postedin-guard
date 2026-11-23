type Valores = { nombre?: string; descripcion?: string | null; severidadBloqueoId?: number; coberturaMinima?: number | null; exigeChecklistIa?: boolean }

export function CamposPolitica({ v = {}, severidades, sufijo = "" }: { v?: Valores; severidades: { id: number; nombre: string }[]; sufijo?: string }) {
  const id = (n: string) => `${n}${sufijo}`
  return (
    <>
      <div className="field">
        <label htmlFor={id("nombre")}>Nombre</label>
        <input id={id("nombre")} name="nombre" className="input" required maxLength={80} defaultValue={v.nombre} />
      </div>
      <div className="field">
        <label htmlFor={id("descripcion")}>Descripción <span className="muted">(opcional)</span></label>
        <input id={id("descripcion")} name="descripcion" className="input" maxLength={255} defaultValue={v.descripcion ?? ""} />
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor={id("sev")}>Bloquea desde la severidad</label>
          <select id={id("sev")} name="severidadBloqueoId" className="input" required defaultValue={v.severidadBloqueoId ?? ""}>
            <option value="" disabled>Elige</option>
            {severidades.map((s) => <option key={s.id} value={s.id}>{s.nombre} o superior</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={id("cob")}>Cobertura mínima (%)</label>
          <input id={id("cob")} name="coberturaMinima" className="input" inputMode="decimal" placeholder="Sin mínimo"
            defaultValue={v.coberturaMinima ?? ""} />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" name="exigeChecklistIa" defaultChecked={v.exigeChecklistIa} />
        <span>Exigir el checklist de revisión IA antes de aprobar el PR</span>
      </label>
    </>
  )
}
