import type { Metadata } from "next"
import { BrandForm } from "@/components/admin/BrandForm"
import { createBrandAction } from "@/lib/actions/admin/brands"

export const metadata: Metadata = { title: "New Brand" }

export default function NewBrandPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">New Brand</h1>
      <div className="mt-6">
        <BrandForm action={createBrandAction} />
      </div>
    </div>
  )
}
