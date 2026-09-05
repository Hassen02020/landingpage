"use client"

import { useFormState, useFormStatus } from "react-dom"
import type { AdminActionState } from "@/lib/actions/admin/products"
import { Input, Label } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  )
}

type ProductFormValues = {
  name: string
  brandId: string | null
  categoryId: string | null
  petType: string
  lifeStage: string | null
  status: string
  isSubscribable: boolean
  shortDescription: string | null
  description: string | null
  ingredients: string | null
  feedingInstructions: string | null
  seoTitle: string | null
  seoDescription: string | null
  sku: string
  size: string | null
  priceCents: number
  compareAtPriceCents: number | null
  quantityAvailable: number
  imageUrl: string | null
}

export function ProductForm({
  action,
  brands,
  categories,
  defaultValues,
  submitLabel = "Create Product",
}: {
  action: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>
  brands: { id: string; name: string }[]
  categories: { id: string; name: string }[]
  defaultValues?: ProductFormValues
  submitLabel?: string
}) {
  const [state, formAction] = useFormState<AdminActionState, FormData>(action, undefined)

  return (
    <form action={formAction} className="grid max-w-3xl gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="name">Product Name</Label>
          <Input id="name" name="name" defaultValue={defaultValues?.name} required />
        </div>
        <div>
          <Label htmlFor="brandId">Brand</Label>
          <Select id="brandId" name="brandId" defaultValue={defaultValues?.brandId ?? ""}>
            <option value="">None</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="categoryId">Category</Label>
          <Select id="categoryId" name="categoryId" defaultValue={defaultValues?.categoryId ?? ""}>
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="petType">Pet Type</Label>
          <Select id="petType" name="petType" defaultValue={defaultValues?.petType ?? "both"}>
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
            <option value="both">Both</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="lifeStage">Life Stage</Label>
          <Select id="lifeStage" name="lifeStage" defaultValue={defaultValues?.lifeStage ?? "all"}>
            <option value="puppy_kitten">Puppy / Kitten</option>
            <option value="adult">Adult</option>
            <option value="senior">Senior</option>
            <option value="all">All</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={defaultValues?.status ?? "draft"}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" name="isSubscribable" defaultChecked={defaultValues?.isSubscribable ?? false} />
          Available for Autoship
        </label>
      </div>

      <div className="grid gap-4">
        <div>
          <Label htmlFor="shortDescription">Short Description</Label>
          <Input id="shortDescription" name="shortDescription" defaultValue={defaultValues?.shortDescription ?? ""} />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            name="description"
            defaultValue={defaultValues?.description ?? ""}
            rows={3}
            className="w-full rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
          />
        </div>
        <div>
          <Label htmlFor="ingredients">Ingredients</Label>
          <textarea
            id="ingredients"
            name="ingredients"
            defaultValue={defaultValues?.ingredients ?? ""}
            rows={2}
            className="w-full rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
          />
        </div>
        <div>
          <Label htmlFor="feedingInstructions">Feeding Instructions</Label>
          <textarea
            id="feedingInstructions"
            name="feedingInstructions"
            defaultValue={defaultValues?.feedingInstructions ?? ""}
            rows={2}
            className="w-full rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
          />
        </div>
        <div>
          <Label htmlFor="imageUrl">Image URL</Label>
          <Input id="imageUrl" name="imageUrl" defaultValue={defaultValues?.imageUrl ?? ""} />
        </div>
      </div>

      <fieldset className="rounded-2xl border border-ink-100 p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Default Variant</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" name="sku" defaultValue={defaultValues?.sku} required />
          </div>
          <div>
            <Label htmlFor="size">Size / Flavor</Label>
            <Input id="size" name="size" defaultValue={defaultValues?.size ?? ""} />
          </div>
          <div>
            <Label htmlFor="priceCents">Price (cents)</Label>
            <Input id="priceCents" name="priceCents" type="number" min="0" defaultValue={defaultValues?.priceCents} required />
          </div>
          <div>
            <Label htmlFor="compareAtPriceCents">Compare-at Price (cents)</Label>
            <Input id="compareAtPriceCents" name="compareAtPriceCents" type="number" min="0" defaultValue={defaultValues?.compareAtPriceCents ?? ""} />
          </div>
          <div>
            <Label htmlFor="quantityAvailable">Stock Quantity</Label>
            <Input id="quantityAvailable" name="quantityAvailable" type="number" min="0" defaultValue={defaultValues?.quantityAvailable ?? 0} required />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-ink-100 p-4">
        <legend className="px-1 text-sm font-semibold text-ink">SEO</legend>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="seoTitle">SEO Title</Label>
            <Input id="seoTitle" name="seoTitle" defaultValue={defaultValues?.seoTitle ?? ""} />
          </div>
          <div>
            <Label htmlFor="seoDescription">SEO Description</Label>
            <Input id="seoDescription" name="seoDescription" defaultValue={defaultValues?.seoDescription ?? ""} />
          </div>
        </div>
      </fieldset>

      {state?.error && <p className="text-sm text-coral-600">{state.error}</p>}

      <SubmitButton label={submitLabel} />
    </form>
  )
}
