import { LoginForm } from "./LoginForm"
import { authConfigured } from "@/lib/server/auth"

export const dynamic = "force-dynamic"

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-6">
        <h1 className="text-xl font-black mb-1">Espace équipe Easy2Book</h1>
        <p className="text-sm text-gray-500 mb-5">Leads des landing pages</p>
        {authConfigured() ? (
          <LoginForm next={searchParams.next || "/admin"} />
        ) : (
          <p className="text-sm text-red-700">Connexion non configurée (LANDING_SUPABASE_URL / LANDING_SUPABASE_PUBLISHABLE_KEY).</p>
        )}
      </div>
    </main>
  )
}
