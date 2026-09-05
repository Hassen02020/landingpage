import { test } from "node:test"
import assert from "node:assert/strict"
import { computePrice } from "./compute.ts"

test("percentage markup applies normally when it clears the floor", () => {
  const result = computePrice(4299, { markupType: "percentage", markupValue: 40, minMarginCents: 500 })
  // 4299 * 1.4 = 6018.6 -> rounds to 6019, which is well above the 500c floor
  assert.equal(result.priceCents, 6019)
  assert.equal(result.floorApplied, false)
})

test("fixed amount markup adds a flat cents value", () => {
  const result = computePrice(1000, { markupType: "fixed_amount", markupValue: 300, minMarginCents: 0 })
  assert.equal(result.priceCents, 1300)
  assert.equal(result.floorApplied, false)
})

test("floor kicks in when the markup is too thin", () => {
  // 5% of 1000 = 50c margin, below the 500c floor
  const result = computePrice(1000, { markupType: "percentage", markupValue: 5, minMarginCents: 500 })
  assert.equal(result.priceCents, 1500)
  assert.equal(result.floorApplied, true)
})

test("floor kicks in on near-zero cost so nothing is ever sold at a loss", () => {
  const result = computePrice(1, { markupType: "percentage", markupValue: 40, minMarginCents: 500 })
  assert.equal(result.priceCents, 501)
  assert.equal(result.floorApplied, true)
})

test("zero markup and zero floor is a no-op (cost passthrough)", () => {
  const result = computePrice(2500, { markupType: "percentage", markupValue: 0, minMarginCents: 0 })
  assert.equal(result.priceCents, 2500)
  assert.equal(result.floorApplied, false)
})
