import Link from "next/link"
import { FormAccion } from "@/components/form-accion"
import { requireLider } from "@/lib/auth/guards"
import { prisma } from "@/lib/db"
import { fmtFechaHora } from "@/lib/formato"
import { ETIQUETA_ROL, esRolValido } from "@/lib/roles"
import { cambiarEstadoUsuarioAction, crearUsuarioAction } from "./actions"
import { CamposUsuario } from "./campos-usuario"

export const metadata = { title: "Usuarios" }

export default async function UsuariosPage() {
  const actor = await requireLider()
  const usuarios = await prisma.usuario.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    select: { id: true, nombre: true, apellido: true, email: true, activo: true, ultimoAcceso: true, usuarioGithub: true, rol: { select: { nombre: true } } },
  })
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Usuarios</h1>
          <p>Cuentas del equipo y su perfil de acceso.</p>
        </div>
      </div>
      <div className="grid grid-2">
        <section className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th className="hide-sm">Perfil</th><th>Estado</th><th className="hide-sm">Último acceso</th><th><span className="sr-only">Acciones</span></th></tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/usuarios/${u.id}`}>{u.nombre} {u.apellido}</Link>
                      <span className="sub">{u.email}{u.usuarioGithub ? ` · @${u.usuarioGithub}` : ""}</span>
                    </td>
                    <td className="hide-sm">{esRolValido(u.rol.nombre) ? ETIQUETA_ROL[u.rol.nombre] : u.rol.nombre}</td>
                    <td><span className={`state ${u.activo ? "activo" : "inactivo"}`}>{u.activo ? "Activa" : "Inactiva"}</span></td>
                    <td className="hide-sm">{fmtFechaHora(u.ultimoAcceso)}</td>
                    <td>
                      {u.id !== actor.id && (
                        <FormAccion compacto variante={u.activo ? "danger" : "light"}
                          boton={u.activo ? "Desactivar" : "Activar"}
                          confirmar={u.activo ? `¿Desactivar la cuenta de ${u.nombre}? Se cerrarán sus sesiones.` : undefined}
                          action={cambiarEstadoUsuarioAction.bind(null, u.id, !u.activo)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <h2>Nueva cuenta</h2>
          <FormAccion action={crearUsuarioAction} boton="Crear cuenta" limpiarAlGuardar>
            <CamposUsuario conEmail />
          </FormAccion>
        </section>
      </div>
    </>
  )
}
