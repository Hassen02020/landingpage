import { z } from "zod"

const ALLOWED_FREQUENCIES = [2, 4, 6, 8] as const

export const autoshipSchema = z.object({
  variantId: z.string().uuid("Invalid product selection."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(99, "Quantity is too high."),
  frequencyWeeks: z.coerce
    .number()
    .int()
    .refine((v) => (ALLOWED_FREQUENCIES as readonly number[]).includes(v), "Invalid Autoship frequency."),
})

export type AutoshipInput = z.infer<typeof autoshipSchema>
