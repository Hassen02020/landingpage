import { test } from "node:test"
import assert from "node:assert/strict"
import { checkQuota } from "./quota.ts"

test("allows when current is below the limit", () => {
  assert.deepEqual(checkQuota(5, 10), { allowed: true, remaining: 5 })
})

test("blocks once current has reached the limit", () => {
  assert.deepEqual(checkQuota(10, 10), { allowed: false, remaining: 0 })
})

test("blocks when current is already over the limit", () => {
  assert.deepEqual(checkQuota(12, 10), { allowed: false, remaining: 0 })
})

test("a null limit is always unlimited", () => {
  assert.deepEqual(checkQuota(1_000_000, null), { allowed: true, remaining: null })
})

test("zero current with zero limit is blocked, not a division-by-zero edge case", () => {
  assert.deepEqual(checkQuota(0, 0), { allowed: false, remaining: 0 })
})
