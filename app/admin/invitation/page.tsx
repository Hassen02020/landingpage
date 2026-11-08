import Image from "next/image"
import { InvitationForm } from "./Form"

export const dynamic = "force-dynamic"

export default function InvitationPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-white">
          <Image src="/logo.png" alt="Easy2Book" width={56} height={56} className="rounded-full bg-white" priority />
          <h1 className="mt-3 text-2xl font-black">Bienvenue</h1>
          <p className="text-sm text-violet-200">Choisissez votre mot de passe pour accéder à votre espace.</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-2xl">
          <InvitationForm />
        </div>
      </div>
    </main>
  )
}
