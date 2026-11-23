export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="login-wrap">
      <section className="login-hero">
        <div className="brand">
          <div className="brand-logo" aria-hidden>PG</div>
          <div>
            <strong>Postedin Guard</strong>
            <small>Seguridad y calidad</small>
          </div>
        </div>
        <div>
          <h1>Cada cambio, revisado antes de llegar a producción.</h1>
          <p>Reúne en un solo lugar los problemas de seguridad y calidad de los repositorios, con responsable y plazo.</p>
          <ul>
            <li>Revisión automática en cada pull request</li>
            <li>Semáforo que detiene los cambios con problemas graves</li>
            <li>Checklist para el código hecho con IA</li>
          </ul>
        </div>
        <small style={{ color: "#b8c3e6" }}>Equipo de desarrollo · Postedin</small>
      </section>
      <main className="login-panel">
        <div className="login-card">{children}</div>
      </main>
    </div>
  )
}
