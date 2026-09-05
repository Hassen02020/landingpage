import { z } from "zod"

export const pricingRuleSchema = z.object({
  name: z.string().min(1, "Name is required."),
  markupType: z.enum(["percentage", "fixed_amount"]),
  markupValue: z.coerce.number().min(0),
  minMarginCents: z.coerce.number().int().min(0),
  isDefault: z.coerce.boolean(),
})
