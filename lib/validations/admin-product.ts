import { z } from "zod"

export const productSchema = z.object({
  name: z.string().min(1, "Name is required."),
  brandId: z.string().optional(),
  categoryId: z.string().optional(),
  petType: z.enum(["dog", "cat", "both"]),
  lifeStage: z.enum(["puppy_kitten", "adult", "senior", "all"]).optional(),
  status: z.enum(["draft", "active", "archived"]),
  isSubscribable: z.coerce.boolean(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  ingredients: z.string().optional(),
  feedingInstructions: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  sku: z.string().min(1, "SKU is required."),
  size: z.string().optional(),
  priceCents: z.coerce.number().int().min(0, "Price must be 0 or more."),
  compareAtPriceCents: z.coerce.number().int().min(0).optional().or(z.literal("").transform(() => undefined)),
  quantityAvailable: z.coerce.number().int().min(0),
  imageUrl: z.string().optional(),
})

export type ProductInput = z.infer<typeof productSchema>
