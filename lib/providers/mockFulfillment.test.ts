import { test } from "node:test"
import assert from "node:assert/strict"
import { deriveMockFulfillmentStatus } from "./mockFulfillment.ts"

const placedAt = 1_700_000_000_000
const orderId = `MOCK-PO-MOCK-DOG-001-${placedAt}`

test("still processing just after placement", () => {
  const result = deriveMockFulfillmentStatus(orderId, placedAt + 5_000)
  assert.deepEqual(result, { status: "processing" })
})

test("shipped once the processing window has passed", () => {
  const result = deriveMockFulfillmentStatus(orderId, placedAt + 60_000)
  assert.equal(result.status, "shipped")
  assert.equal(result.carrier, "Mock Freight Co")
  assert.ok(result.trackingNumber)
  assert.ok(result.trackingUrl?.includes(result.trackingNumber!))
  assert.equal(result.shippedAt, new Date(placedAt + 30_000).toISOString())
  assert.equal(result.deliveredAt, undefined)
})

test("delivered once the shipped window has passed", () => {
  const result = deriveMockFulfillmentStatus(orderId, placedAt + 200_000)
  assert.equal(result.status, "delivered")
  assert.equal(result.deliveredAt, new Date(placedAt + 180_000).toISOString())
})

test("rejects a provider order id it didn't generate", () => {
  assert.throws(() => deriveMockFulfillmentStatus("not-a-real-order-id", Date.now()))
})
