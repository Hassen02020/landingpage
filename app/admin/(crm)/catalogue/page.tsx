import Link from "next/link"
import { currentStaff } from "@/lib/server/auth"
import { select } from "@/lib/server/db"
import { PRODUCTS, type Product } from "@/lib/config"
import { listCategories, listOffers, seatsLeft, type Category, type Offer } from "@/lib/server/catalog"
import { archiveOfferAction, duplicateOfferAction } from "../../catalog-actions"

export const dynamic = "force-dynamic"

const tnd = (n: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n)} TND`
const day = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—")

export default async function CataloguePage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const staff = await currentStaff()
  if (staff?.role !== "admin") return <p className="bg-white rounded-2xl p-6">Cette page est réservée aux administrateurs.</p>
  const tab = ["offres", "archivees", "categories"].includes(searchParams.tab || "") ? searchParams.tab! : "offres"

  let offers: Offer[] = []
  let categories: Category[] = []
  let crm: { offer_id: string; adults: number | null; children: number | null }[] = []
  let ready = true
  try {
    ;[offers, categories, crm] = await Promise.all([
      listOffers({ archived: tab === "archivees", categoryId: searchParams.cat, q: searchParams.q }),
      listCategories(),
      select<{ offer_id: string; adults: number | null; children: number | null }>("landing_leads", "select=offer_id,adults,children&status=in.(reserve,gagne)&offer_id=not.is.null&limit=10000"),
    ])
  } catch {
    ready = false
  }
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const crmPeople = new Map<string, number>()
  crm.forEach((l) => crmPeople.set(l.offer_id, (crmPeople.get(l.offer_id) ?? 0) + (l.adults ?? 1) + (l.children ?? 0)))

  const active = offers.filter((o) => !o.archived_at)
  const seatsTotal = active.reduce((a, o) => a + (o.seats_total ?? 0), 0)
  const seatsSold = active.reduce((a, o) => a + o.seats_sold, 0)
  const remainingValue = active.reduce((a, o) => a + (seatsLeft(o) ?? 0) * Number(o.price), 0)
  const soldRevenue = active.reduce((a, o) => a + o.seats_sold * Number(o.price), 0)
  const soldMargin = active.reduce((a, o) => a + (o.cost !== null && o.cost !== undefined ? o.seats_sold * (Number(o.price) - Number(o.cost)) : 0), 0)

  const tabCls = (t: string) => `px-4 py-2 rounded-xl text-sm font-bold ${tab === t ? "bg-white shadow-sm" : "text-gray-600"}`
  const th = "px-2.5 py-3 text-left text-gray-500 font-semibold whitespace-nowrap"
  const td = "px-2.5 py-3 whitespace-nowrap"

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Catalogue</h1>
          <p className="text-sm text-gray-600">Départs, prix, places et pages publiques. Les changements apparaissent sur le site en moins d&apos;une minute.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/catalogue/categories/new" className="border bg-white font-bold px-4 py-2 rounded-xl">+ Catégorie</Link>
          <Link href="/admin/catalogue/offres/new" className="bg-violet-700 hover:bg-violet-800 text-white font-bold px-4 py-2 rounded-xl">+ Ajouter une offre</Link>
        </div>
      </div>

      {!ready && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">
          La migration <code>0004_landing_catalog.sql</code> n&apos;est pas encore appliquée : le site affiche les offres intégrées.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border p-4"><div className="text-2xl font-black">{seatsTotal}</div><div className="text-sm font-semibold">Places totales</div><div className="text-xs text-gray-500 mt-1">vendues : {seatsSold}</div></div>
        <div className="bg-white rounded-2xl border p-4"><div className="text-2xl font-black">{seatsTotal - seatsSold}</div><div className="text-sm font-semibold">Places restantes</div><div className="text-xs text-gray-500 mt-1">valeur : {tnd(remainingValue)}</div></div>
        <div className="bg-white rounded-2xl border p-4"><div className="text-xl sm:text-2xl font-black whitespace-nowrap">{tnd(soldRevenue)}</div><div className="text-sm font-semibold">CA des places vendues</div><div className="text-xs text-gray-500 mt-1">marge prévue : {tnd(soldMargin)}</div></div>
        <div className="rounded-2xl p-4 bg-gradient-to-br from-green-600 to-emerald-500 text-white"><div className="text-sm">Revenu estimé (tout vendu)</div><div className="text-xl sm:text-2xl font-black whitespace-nowrap">{tnd(soldRevenue + remainingValue)}</div></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="bg-gray-100 rounded-2xl p-1 flex gap-1">
          <Link href="/admin/catalogue" className={tabCls("offres")}>Offres</Link>
          <Link href="/admin/catalogue?tab=archivees" className={tabCls("archivees")}>Archivées</Link>
          <Link href="/admin/catalogue?tab=categories" className={tabCls("categories")}>Catégories</Link>
        </div>
        {tab !== "categories" && (
          <form className="flex w-full flex-wrap gap-2 sm:w-auto">
            {tab === "archivees" && <input type="hidden" name="tab" value="archivees" />}
            <input name="q" defaultValue={searchParams.q} placeholder="Rechercher…" className="min-w-0 flex-1 border rounded-xl px-3 py-2 text-sm sm:flex-none" />
            <select name="cat" defaultValue={searchParams.cat ?? ""} className="min-w-0 flex-1 border rounded-xl px-3 py-2 text-sm sm:flex-none">
              <option value="">Toutes les catégories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="bg-gray-900 text-white font-bold px-4 py-2 rounded-xl text-sm">Filtrer</button>
          </form>
        )}
      </div>

      {tab === "categories" ? (
        <section className="bg-white rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{["Nom", "Adresse", "Produit", "Langue", "Statut", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {categories.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">Aucune catégorie.</td></tr>}
              {categories.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className={`${td} font-bold`}>{c.name}</td>
                  <td className={td}><a href={c.slug === "omra-2027" ? "/omra" : `/c/${c.slug}`} target="_blank" className="underline" dir="ltr">{c.slug === "omra-2027" ? "/omra" : `/c/${c.slug}`}</a></td>
                  <td className={td}>{PRODUCTS[c.product as Product]}</td>
                  <td className={td}>{c.lang === "ar" ? "Arabe" : "Français"}</td>
                  <td className={td}><span className={`text-xs font-bold px-2 py-1 rounded-full ${c.visible ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>{c.visible ? "Affichée" : "Masquée"}</span></td>
                  <td className={td}><Link href={`/admin/catalogue/categories/${c.id}`} className="underline">Modifier</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="bg-white rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{["", "Offre", "Départ", "Prix / coût", "Places", "Statut", "Actions"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {offers.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-500">{tab === "archivees" ? "Aucune offre archivée." : "Aucune offre pour le moment."}</td></tr>}
              {offers.map((o) => {
                const left = seatsLeft(o)
                return (
                  <tr key={o.id} className="border-t">
                    <td className="p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {o.image_url ? <img src={o.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg bg-gray-100" />}
                    </td>
                    <td className={td}><div className="font-bold">{o.name}</div><div className="text-xs text-gray-500">{[o.sku, o.nights !== null ? `${o.nights} nuits` : null, o.category_id ? catName.get(o.category_id) : null].filter(Boolean).join(" · ")}</div></td>
                    <td className={td}>{day(o.departure_date)}</td>
                    <td className={td}><div className="font-semibold">{tnd(Number(o.price))}</div><div className="text-xs text-gray-500">coût {o.cost !== null && o.cost !== undefined ? tnd(Number(o.cost)) : "—"}</div></td>
                    <td className={td}><div>{o.seats_total === null ? "non suivies" : `${o.seats_sold} / ${o.seats_total}`}{left === 0 && <span className="ml-1 text-xs font-bold text-red-600">complet</span>}</div><div className="text-xs text-gray-500">CRM : {crmPeople.get(o.id) ?? 0} pers.</div></td>
                    <td className={td}><span className={`text-xs font-bold px-2 py-1 rounded-full ${o.visible ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>{o.visible ? "Affichée" : "Masquée"}</span></td>
                    <td className={`${td} flex gap-1.5 items-center`}>
                      <Link href={`/admin/catalogue/offres/${o.id}`} className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-gray-50">Modifier</Link>
                      <form action={duplicateOfferAction}><input type="hidden" name="id" value={o.id} /><button className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-gray-50">Dupliquer</button></form>
                      <form action={archiveOfferAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="archived" value={String(!o.archived_at)} />
                        <button className={`rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-gray-50 ${o.archived_at ? "text-green-700" : "text-red-700"}`}>{o.archived_at ? "Restaurer" : "Archiver"}</button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
      <p className="text-xs text-gray-500">« CRM » = voyageurs des leads au statut Réservé liés à l&apos;offre (formulaire). « Places vendues » se met à jour dans la fiche de l&apos;offre.</p>
    </div>
  )
}
