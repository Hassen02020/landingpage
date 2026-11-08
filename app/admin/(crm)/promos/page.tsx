import { can } from "@/lib/permissions"
import Link from "next/link"
import { currentStaff } from "@/lib/server/auth"
import { PRODUCTS, type Product } from "@/lib/config"
import { discountLabel, listPromos, promoStatus, type PromoStatus } from "@/lib/server/promo"
import { togglePromoAction } from "../../settings-actions"
import { CreatePromo } from "./CreatePromo"

export const dynamic = "force-dynamic"

const STATUS: Record<PromoStatus, { label: string; cls: string }> = {
  active: { label: "Actif", cls: "bg-green-100 text-green-800" },
  scheduled: { label: "Programmé", cls: "bg-blue-100 text-violet-700" },
  expired: { label: "Expiré", cls: "bg-gray-200 text-gray-600" },
  exhausted: { label: "Épuisé", cls: "bg-amber-100 text-amber-800" },
  disabled: { label: "Désactivé", cls: "bg-red-100 text-red-700" },
}

const day = (d: string | null) => (d ? d.split("-").reverse().join("/") : "…")

export default async function PromosPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const staff = await currentStaff()
  if (!can(staff?.orgRole, "promos.manage")) return <p className="bg-white rounded-2xl p-6">Cette page est réservée aux administrateurs.</p>
  const all = await listPromos()
  const q = (searchParams.q || "").trim().toUpperCase()
  const st = searchParams.status as PromoStatus | undefined
  const rows = (all ?? []).filter((p) => (!q || p.code.includes(q) || p.title.toUpperCase().includes(q)) && (!st || promoStatus(p) === st))
  const th = "p-3 text-left text-gray-500 font-semibold whitespace-nowrap"
  const td = "p-3 whitespace-nowrap"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Codes promo</h1>
        <p className="text-sm text-gray-600">Le visiteur saisit le code dans le formulaire ; il est vérifié, compté et affiché sur le lead. La remise est appliquée par l&apos;équipe à la réservation.</p>
      </div>
      {all === null && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">
          La migration <code>0003_landing_admin.sql</code> n&apos;est pas encore appliquée.
        </div>
      )}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
        <h2 className="font-black">Nouveau code</h2>
        <CreatePromo />
      </section>
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <form className="p-3 flex flex-wrap gap-2 border-b">
          <input name="q" defaultValue={searchParams.q} placeholder="Rechercher par code" className="border rounded-xl px-3 py-2 text-sm" />
          <select name="status" defaultValue={st ?? ""} className="border rounded-xl px-3 py-2 text-sm">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button className="bg-gray-900 text-white font-bold px-4 py-2 rounded-xl text-sm">Filtrer</button>
          {(q || st) && <Link href="/admin/promos" className="text-sm underline self-center">Effacer</Link>}
        </form>
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>{["Code", "Titre", "Remise", "Produit", "Période", "Utilisation", "Statut", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-gray-500">Aucune promotion pour le moment.</td></tr>}
            {rows.map((p) => {
              const s = STATUS[promoStatus(p)]
              return (
                <tr key={p.id} className="border-t">
                  <td className={`${td} font-mono font-bold`}>{p.code}</td>
                  <td className={td}>{p.title}</td>
                  <td className={td}>{discountLabel(p)}</td>
                  <td className={td}>{p.product ? PRODUCTS[p.product as Product] : "Tous"}</td>
                  <td className={td}>{day(p.starts_on)} → {day(p.ends_on)}</td>
                  <td className={td}>{p.used_count} / {p.max_uses ?? "∞"}</td>
                  <td className={td}><span className={`text-xs font-bold px-2 py-1 rounded-full ${s.cls}`}>{s.label}</span></td>
                  <td className={td}>
                    <form action={togglePromoAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="active" value={String(!p.active)} />
                      <button className="text-xs border rounded-lg px-2 py-1 hover:bg-gray-50">{p.active ? "Désactiver" : "Réactiver"}</button>
                    </form>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
