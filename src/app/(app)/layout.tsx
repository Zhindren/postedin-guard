import { Shell } from "@/components/sidebar"
import { esLider, requireUser } from "@/lib/auth/guards"
import { ETIQUETA_ROL } from "@/lib/roles"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireUser()
  return (
    <Shell esLider={esLider(s)} usuario={{ nombre: s.nombre, email: s.email, rolEtiqueta: ETIQUETA_ROL[s.rol] }}>
      {children}
    </Shell>
  )
}
