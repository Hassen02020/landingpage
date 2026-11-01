import Link from "next/link"
import { redirect } from "next/navigation"
import { currentStaff } from "@/lib/server/auth"
import { logoutAction } from "../actions"

export const dynamic = "force-dynamic"

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const staff = await currentStaff()
  if (!staff) redirect("/admin/login")
  return (
    <>
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4">
          <Link href="/admin" className="font-black">Easy2Book · Leads</Link>
          <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-gray-600">
            <Link href="/admin" className="hover:text-blue-800">Leads</Link>
            <Link href="/admin?followUp=due" className="hover:text-blue-800">Relances</Link>
            <Link href="/admin/pipeline" className="hover:text-blue-800">Pipeline</Link>
            <Link href="/admin/leads/new" className="hover:text-blue-800">+ Nouveau lead</Link>
            <Link href="/admin/stats" className="hover:text-blue-800">Statistiques</Link>
            <Link href="/admin/calculateur" className="hover:text-blue-800">Calculateur</Link>
            {staff.role === "admin" && (
              <>
                <Link href="/admin/catalogue" className="hover:text-blue-800">Catalogue</Link>
                <Link href="/admin/promos" className="hover:text-blue-800">Codes promo</Link>
                <Link href="/admin/protection" className="hover:text-blue-800">Protection</Link>
                <Link href="/admin/integrations" className="hover:text-blue-800">Intégrations</Link>
                <Link href="/admin/equipe" className="hover:text-blue-800">Équipe</Link>
                <Link href="/admin/modeles" className="hover:text-blue-800">Modèles</Link>
                <a href="/admin/export" className="hover:text-blue-800">Export CSV</a>
              </>
            )}
          </nav>
          <form action={logoutAction} className="ml-auto flex items-center gap-2 text-sm">
            <Link href="/admin/compte" className="text-gray-500 hover:underline">{staff.email}</Link>
            <button className="px-3 py-1 rounded-lg border hover:bg-gray-100">Déconnexion</button>
          </form>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </>
  )
}
