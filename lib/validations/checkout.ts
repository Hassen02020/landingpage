import { z } from "zod"

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
  "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
  "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
] as const

export const checkoutSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  fullName: z.string().min(1, "Full name is required."),
  line1: z.string().min(1, "Address is required."),
  line2: z.string().optional(),
  city: z.string().min(1, "City is required."),
  state: z.enum(US_STATES, { message: "Select a state." }),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a valid US ZIP code."),
  phone: z.string().optional(),
  shippingMethod: z.enum(["standard", "express"]),
  couponCode: z.string().optional(),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
