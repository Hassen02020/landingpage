import { test } from "node:test"
import assert from "node:assert/strict"
import { computeInventoryDelta } from "./delta.ts"

test("first sync (no prior reading) never adjusts", () => {
  assert.equal(computeInventoryDelta(null, 42), 0)
})

test("stock decreased at the supplier -> negative delta", () => {
  assert.equal(computeInventoryDelta(100, 82), -18)
})

test("stock increased at the supplier (restock) -> positive delta", () => {
  assert.equal(computeInventoryDelta(50, 75), 25)
})

test("no change -> zero delta", () => {
  assert.equal(computeInventoryDelta(60, 60), 0)
})
