import { z } from "zod"

export const createRecallSchema = z.object({
  variantId: z.string().uuid(),
  lotNumber: z.string().optional(),
  reason: z.string().min(1, "Reason is required."),
  severity: z.enum(["low", "medium", "high", "critical"]),
})
