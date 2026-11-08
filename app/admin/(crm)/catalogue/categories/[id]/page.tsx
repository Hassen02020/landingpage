import { can } from "@/lib/permissions"
import Link from "next/link"
import { notFound } from "next/navigation"
import { currentStaff } from "@/lib/server/auth"
import { getCategory } from "@/lib/server/catalog"
import { CategoryForm } from "./CategoryForm"

export const dynamic = "force-dynamic"

export default async function CategoryEditPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string } }) {
  const staff = await currentStaff()
  if (!can(staff?.orgRole, "catalog.manage")) return <p className="bg-white rounded-2xl p-6">Cette page est réservée aux administrateurs.</p>
  const isNew = params.id === "new"
  const category = isNew ? null : await getCategory(params.id).catch(() => null)
  if (!isNew && !category) notFound()
  const href = category ? (category.slug === "omra-2027" ? "/omra" : `/c/${category.slug}`) : null
  return (
    <div className="space-y-4">
      <Link href="/admin/catalogue?tab=categories" className="text-sm underline">← Catégories</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black">{isNew ? "Ajouter une catégorie" : category!.name}</h1>
        {href && <a href={href} target="_blank" className="text-sm underline">Voir la page ↗</a>}
      </div>
      {searchParams.ok && <div className="p-3 rounded-xl bg-green-50 text-green-800 text-sm">Catégorie créée.</div>}
      <CategoryForm category={category} />
    </div>
  )
}
