import Link from "next/link"
import { builderAccess } from "@/lib/server/page-builder"
import { THEMES } from "@/lib/page-builder/themes"

export const dynamic = "force-dynamic"

const FAMILY_LABEL = { omra: "Famille Omra", voyage: "Famille Voyage", hotel: "Famille Hôtel", autre: "Famille Offre" } as const
const FAMILY_BG = { omra: "from-emerald-800 to-emerald-950", voyage: "from-sky-800 to-indigo-950", hotel: "from-teal-700 to-teal-950", autre: "from-violet-800 to-fuchsia-950" } as const

export default async function ThemeChoice() {
  const access = await builderAccess()
  if (!access.ok) return <p className="bg-white rounded-2xl p-6 text-gray-700">{access.message}</p>
  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/createur" className="text-sm text-violet-700 font-semibold">← Mes pages</Link>
        <h1 className="text-2xl font-black mt-1">Étape 1 — Choisissez un modèle</h1>
        <p className="text-gray-600 text-sm max-w-2xl">Le modèle règle le produit, la langue et les informations à fournir. La page publique prend l&apos;apparence de sa famille (Omra, Voyage, Hôtel ou Offre) et n&apos;affiche que les sections pour lesquelles vous avez des informations.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {THEMES.map((t) => (
          <Link key={t.id} href={`/admin/createur/nouvelle?theme=${t.id}&etape=infos`} className="group bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition-shadow" data-theme={t.id}>
            <div className={`h-20 bg-gradient-to-br ${FAMILY_BG[t.family]} flex items-center justify-between px-4 text-white`}>
              <span className="text-3xl" aria-hidden="true">{t.emoji}</span>
              <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-full">{FAMILY_LABEL[t.family]}</span>
            </div>
            <div className="p-4">
              <h2 className="font-black group-hover:text-violet-700">{t.label}</h2>
              <p className="text-sm text-gray-600 mt-1">{t.tagline}</p>
              <p className="text-xs text-gray-500 mt-2">Langue : {t.lang === "ar" ? "arabe" : "français"} · à fournir : {t.offerRequired.length ? "prix" + t.offerRequired.map((f) => ({ departure_date: ", date", nights: ", nuits", destination: ", destination", description: ", programme", price_before: ", prix barré" } as Record<string, string>)[f] ?? "").join("") : "nom et prix"}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
