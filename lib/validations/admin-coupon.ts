import { z } from "zod"

export const couponSchema = z.object({
  code: z.string().min(1, "Code is required.").transform((v) => v.toUpperCase()),
  type: z.enum(["percentage", "fixed", "free_shipping"]),
  value: z.coerce.number().min(0),
  minOrderCents: z.coerce.number().int().min(0),
  usageLimit: z.coerce.number().int().min(0).optional().or(z.literal("").transform(() => undefined)),
  firstOrderOnly: z.coerce.boolean(),
  expiresAt: z.string().optional(),
  isActive: z.coerce.boolean(),
})
