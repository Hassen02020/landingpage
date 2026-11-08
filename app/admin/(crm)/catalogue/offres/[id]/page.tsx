import { can } from "@/lib/permissions"
import Link from "next/link"
import { notFound } from "next/navigation"
import { currentStaff } from "@/lib/server/auth"
import { getOffer, listCategories } from "@/lib/server/catalog"
import { OfferForm } from "./OfferForm"

export const dynamic = "force-dynamic"

export default async function OfferPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string } }) {
  const staff = await currentStaff()
  if (!can(staff?.orgRole, "catalog.manage")) return <p className="bg-white rounded-2xl p-6">Cette page est réservée aux administrateurs.</p>
  const isNew = params.id === "new"
  const [offer, categories] = await Promise.all([isNew ? null : getOffer(params.id).catch(() => null), listCategories().catch(() => [])])
  if (!isNew && !offer) notFound()
  return (
    <div className="space-y-4">
      <Link href="/admin/catalogue" className="text-sm underline">← Catalogue</Link>
      <h1 className="text-2xl font-black">{isNew ? "Nouvelle offre" : `Modifier ${offer!.name}`}</h1>
      {searchParams.ok && <div className="p-3 rounded-xl bg-green-50 text-green-800 text-sm">{searchParams.ok === "copie" ? "Copie créée (masquée) : vérifiez puis affichez-la." : "Offre créée."}</div>}
      <OfferForm offer={offer} categories={categories} />
    </div>
  )
}
