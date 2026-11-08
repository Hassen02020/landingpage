import Image from "next/image"
import { redirect } from "next/navigation"
import { logoutAction } from "../actions"
import { currentPlatformAdmin } from "@/lib/server/platform"

export const dynamic = "force-dynamic"

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentPlatformAdmin()
  if (!actor) redirect("/admin/login")
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-violet-950 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="" width={32} height={32} className="rounded-full bg-white" />
            <div>
              <div className="font-black leading-tight">Plateforme</div>
              <div className="text-[11px] text-violet-300">Super Admin · {actor.email}</div>
            </div>
          </div>
          <form action={logoutAction}>
            <button className="rounded-xl border border-white/30 px-3 py-1.5 text-sm font-bold hover:bg-white/10">Déconnexion</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">{children}</main>
    </div>
  )
}
