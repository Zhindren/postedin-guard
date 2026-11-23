"use client"

import { useActionState } from "react"
import type { EstadoForm } from "@/lib/resultado"

type Item = { id: number; pregunta: string; respuesta: { cumple: boolean; observacion: string | null } | null }

export function ChecklistForm({ items, action }: { items: Item[]; action: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm> }) {
  const [estado, accion, pendiente] = useActionState<EstadoForm, FormData>(action, {})
  return (
    <form action={accion} className="stack">
      {estado.error && <div className="alert danger" role="alert">{estado.error}</div>}
      {estado.ok && <div className="alert ok" role="status">{estado.ok}</div>}
      <div>
        {items.map((it, i) => (
          <fieldset className="checklist-item" key={it.id} style={{ border: 0, margin: 0, display: "block" }}>
            <div className="spread">
              <legend style={{ padding: 0, float: "left", maxWidth: "70%" }}>{i + 1}. {it.pregunta}</legend>
              <div className="segmented" role="radiogroup">
                <input type="radio" id={`si_${it.id}`} name={`cumple_${it.id}`} value="si" required defaultChecked={it.respuesta?.cumple === true} />
                <label htmlFor={`si_${it.id}`} className="yes">Cumple</label>
                <input type="radio" id={`no_${it.id}`} name={`cumple_${it.id}`} value="no" defaultChecked={it.respuesta?.cumple === false} />
                <label htmlFor={`no_${it.id}`} className="no">No cumple</label>
              </div>
            </div>
            <div className="obs">
              <label htmlFor={`obs_${it.id}`} className="sr-only">Observación del ítem {i + 1}</label>
              <input id={`obs_${it.id}`} name={`obs_${it.id}`} className="input" maxLength={255}
                placeholder="Observación (obligatoria si no cumple)" defaultValue={it.respuesta?.observacion ?? ""} />
            </div>
          </fieldset>
        ))}
      </div>
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar checklist"}</button>
      </div>
    </form>
  )
}
