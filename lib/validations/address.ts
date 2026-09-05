import { z } from "zod"
import { US_STATES } from "@/lib/validations/checkout"

export const addressSchema = z.object({
  label: z.string().optional(),
  fullName: z.string().min(1, "Full name is required."),
  line1: z.string().min(1, "Address is required."),
  line2: z.string().optional(),
  city: z.string().min(1, "City is required."),
  state: z.enum(US_STATES, { message: "Select a state." }),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a valid US ZIP code."),
  phone: z.string().optional(),
})
