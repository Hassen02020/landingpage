import { test } from "node:test"
import assert from "node:assert/strict"
import { computeRemainingReturnable } from "./remaining.ts"

test("full quantity remains when nothing has been requested yet", () => {
  const result = computeRemainingReturnable([{ id: "a", quantity: 3 }], {})
  assert.deepEqual(result, { a: 3 })
})

test("subtracts quantity already requested in a non-rejected return", () => {
  const result = computeRemainingReturnable([{ id: "a", quantity: 3 }], { a: 2 })
  assert.deepEqual(result, { a: 1 })
})

test("clamps at zero rather than going negative", () => {
  const result = computeRemainingReturnable([{ id: "a", quantity: 2 }], { a: 5 })
  assert.deepEqual(result, { a: 0 })
})

test("items with no prior returns default to their full quantity", () => {
  const result = computeRemainingReturnable(
    [
      { id: "a", quantity: 2 },
      { id: "b", quantity: 4 },
    ],
    { a: 1 }
  )
  assert.deepEqual(result, { a: 1, b: 4 })
})
