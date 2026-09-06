import { z } from "zod"

export const returnRequestSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().max(2000).optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.coerce.number().int().min(0),
      })
    )
    .min(1, "Select at least one item to return.")
    .refine((items) => items.some((i) => i.quantity > 0), "Select at least one item to return."),
})

export type ReturnRequestInput = z.infer<typeof returnRequestSchema>
