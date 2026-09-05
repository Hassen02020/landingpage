import { test } from "node:test"
import assert from "node:assert/strict"
import { autoshipSchema } from "./autoship.ts"

const VALID_VARIANT_ID = "11111111-1111-4111-8111-111111111111"

test("rejects invalid Autoship frequency (not in 2,4,6,8)", () => {
  for (const frequencyWeeks of [1, 3, 5, 7, 9, 0, -4]) {
    const result = autoshipSchema.safeParse({ variantId: VALID_VARIANT_ID, quantity: 1, frequencyWeeks })
    assert.equal(result.success, false, `frequencyWeeks=${frequencyWeeks} should be rejected`)
  }
})

test("rejects invalid Autoship quantity", () => {
  for (const quantity of [0, -1, 100, 1.5]) {
    const result = autoshipSchema.safeParse({ variantId: VALID_VARIANT_ID, quantity, frequencyWeeks: 4 })
    assert.equal(result.success, false, `quantity=${quantity} should be rejected`)
  }
})

test("rejects a missing/invalid variant id", () => {
  const result = autoshipSchema.safeParse({ variantId: "not-a-uuid", quantity: 1, frequencyWeeks: 4 })
  assert.equal(result.success, false)
})

test("accepts valid Autoship values", () => {
  for (const frequencyWeeks of [2, 4, 6, 8]) {
    const result = autoshipSchema.safeParse({ variantId: VALID_VARIANT_ID, quantity: 1, frequencyWeeks })
    assert.equal(result.success, true, `frequencyWeeks=${frequencyWeeks} should be accepted`)
  }
  const result = autoshipSchema.safeParse({ variantId: VALID_VARIANT_ID, quantity: 3, frequencyWeeks: 4 })
  assert.equal(result.success, true)
})
