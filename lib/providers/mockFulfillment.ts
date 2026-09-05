import type { FulfillmentStatus } from "./types"

// Mirrors the id shape mock.ts's placeOrder() generates: MOCK-PO-{sku}-{epochMs}.
const PROVIDER_ORDER_ID_PATTERN = /-(\d+)$/

const PROCESSING_WINDOW_MS = 30_000
const SHIPPED_WINDOW_MS = 180_000

/**
 * Deterministic stand-in for a real supplier's order-status endpoint: the
 * mock "warehouse" processes for 30s, ships for the next 2.5 minutes, then
 * reports delivered — driven entirely by the timestamp embedded in the
 * provider order id, so the same id always resolves to the same status as
 * of a given moment (no hidden state, no randomness).
 */
export function deriveMockFulfillmentStatus(providerOrderId: string, nowMs: number): FulfillmentStatus {
  const match = providerOrderId.match(PROVIDER_ORDER_ID_PATTERN)
  if (!match) throw new Error(`Mock provider: unrecognized provider order id "${providerOrderId}".`)

  const placedAtMs = Number.parseInt(match[1], 10)
  const elapsed = nowMs - placedAtMs

  if (elapsed < PROCESSING_WINDOW_MS) {
    return { status: "processing" }
  }

  const shippedAt = new Date(placedAtMs + PROCESSING_WINDOW_MS).toISOString()
  const trackingNumber = `MOCKTRACK${placedAtMs}`

  if (elapsed < SHIPPED_WINDOW_MS) {
    return {
      status: "shipped",
      carrier: "Mock Freight Co",
      trackingNumber,
      trackingUrl: `https://track.mockfreight.example/${trackingNumber}`,
      shippedAt,
    }
  }

  return {
    status: "delivered",
    carrier: "Mock Freight Co",
    trackingNumber,
    trackingUrl: `https://track.mockfreight.example/${trackingNumber}`,
    shippedAt,
    deliveredAt: new Date(placedAtMs + SHIPPED_WINDOW_MS).toISOString(),
  }
}
