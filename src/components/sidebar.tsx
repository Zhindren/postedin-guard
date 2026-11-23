"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cerrarSesion } from "@/app/(app)/sesion-actions"

type Item = { href: string; texto: string }

const GENERAL: Item[] = [
  { href: "/", texto: "Dashboard" },
  { href: "/hallazgos", texto: "Hallazgos" },
  { href: "/escaneos", texto: "Escaneos (PR)" },
]
const ADMIN: Item[] = [
  { href: "/repositorios", texto: "Repositorios" },
  { href: "/politicas", texto: "Políticas" },
  { href: "/usuarios", texto: "Usuarios" },
  { href: "/bitacora", texto: "Bitácora" },
]

function activo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar({ esLider, abierto, onCerrar }: { esLider: boolean; abierto: boolean; onCerrar: () => void }) {
  const pathname = usePathname()
  const enlace = (i: Item) => (
    <Link key={i.href} href={i.href} className={activo(pathname, i.href) ? "active" : undefined}
      aria-current={activo(pathname, i.href) ? "page" : undefined} onClick={onCerrar}>
      <span className="dot" aria-hidden />{i.texto}
    </Link>
  )
  return (
    <>
      <aside className={`sidebar${abierto ? " open" : ""}`} id="menu-principal">
        <div className="brand">
          <div className="brand-logo" aria-hidden>PG</div>
          <div><strong>Postedin Guard</strong><small>Seguridad y calidad</small></div>
        </div>
        <nav className="nav" aria-label="Navegación principal">
          <div className="nav-title">General</div>
          {GENERAL.map(enlace)}
          {esLider && (<><div className="nav-title">Administración</div>{ADMIN.map(enlace)}</>)}
          <div className="nav-title">Cuenta</div>
          {enlace({ href: "/perfil", texto: "Mi perfil" })}
          <form action={cerrarSesion}>
            <button type="submit" className="nav-logout"><span className="dot" aria-hidden />Cerrar sesión</button>
          </form>
        </nav>
        <div className="sidebar-foot">Postedin Guard v1.0</div>
      </aside>
      <div className="sidebar-backdrop" onClick={onCerrar} aria-hidden />
    </>
  )
}

export function Shell({ esLider, usuario, children }: {
  esLider: boolean
  usuario: { nombre: string; email: string; rolEtiqueta: string }
  children: React.ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const iniciales = usuario.nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase()
  return (
    <div className="app">
      <Sidebar esLider={esLider} abierto={abierto} onCerrar={() => setAbierto(false)} />
      <div className="main">
        <header className="topbar">
          <button className="menu-btn" type="button" aria-label="Abrir menú" aria-controls="menu-principal"
            aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>☰</button>
          <form action="/hallazgos" className="search" role="search" style={{ padding: 0, border: 0, background: "none" }}>
            <label htmlFor="buscar" className="sr-only">Buscar hallazgos</label>
            <input id="buscar" name="q" className="input" placeholder="Buscar hallazgo, archivo o regla…" maxLength={100} />
          </form>
          <div className="user">
            <span className={`role-badge${esLider ? "" : " dev"}`}>{usuario.rolEtiqueta}</span>
            <div className="avatar" aria-hidden>{iniciales}</div>
            <div className="who"><strong>{usuario.nombre}</strong><small>{usuario.email}</small></div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
