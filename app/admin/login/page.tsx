import Image from "next/image"
import { LoginForm } from "./LoginForm"
import { authConfigured } from "@/lib/server/auth"

export const dynamic = "force-dynamic"

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-white">
          <Image src="/logo.png" alt="Easy2Book" width={56} height={56} className="rounded-full bg-white" priority />
          <h1 className="mt-3 text-2xl font-black">Espace équipe</h1>
          <p className="text-sm text-violet-200">Leads, catalogue et statistiques</p>
        </div>
        <div className="bg-white rounded-3xl shadow-2xl p-6">
          {authConfigured() ? (
            <LoginForm next={searchParams.next || "/admin"} />
          ) : (
            <p className="text-sm text-red-700">Connexion non configurée (LANDING_SUPABASE_URL / LANDING_SUPABASE_PUBLISHABLE_KEY).</p>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-violet-300">Accès réservé aux équipes invitées.</p>
      </div>
    </main>
  )
}
