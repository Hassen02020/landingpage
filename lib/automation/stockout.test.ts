import { test } from "node:test"
import assert from "node:assert/strict"
import { selectOutOfStockProductIds } from "./stockout.ts"

test("flags a product whose only variant has zero stock", () => {
  const result = selectOutOfStockProductIds([{ id: "p1", product_variants: [{ id: "v1", inventory: { quantity_available: 0 } }] }])
  assert.deepEqual(result, ["p1"])
})

test("leaves a product alone if any variant still has stock", () => {
  const result = selectOutOfStockProductIds([
    {
      id: "p1",
      product_variants: [
        { id: "v1", inventory: { quantity_available: 0 } },
        { id: "v2", inventory: { quantity_available: 3 } },
      ],
    },
  ])
  assert.deepEqual(result, [])
})

test("leaves a product with no variants alone", () => {
  const result = selectOutOfStockProductIds([{ id: "p1", product_variants: [] }])
  assert.deepEqual(result, [])
})

test("treats a missing inventory row as zero stock", () => {
  const result = selectOutOfStockProductIds([{ id: "p1", product_variants: [{ id: "v1", inventory: null }] }])
  assert.deepEqual(result, ["p1"])
})

test("handles inventory returned as an array (one-to-many embed shape)", () => {
  const result = selectOutOfStockProductIds([{ id: "p1", product_variants: [{ id: "v1", inventory: [{ quantity_available: 0 }] }] }])
  assert.deepEqual(result, ["p1"])
})
