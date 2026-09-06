import { z } from "zod"

export const receiveLotSchema = z.object({
  variantId: z.string().uuid(),
  lotNumber: z.string().min(1, "Lot number is required."),
  quantityReceived: z.coerce.number().int().min(1, "Must receive at least 1 unit."),
  expiryDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
})
