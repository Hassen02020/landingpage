import { test } from "node:test"
import assert from "node:assert/strict"
import { mockProviderAdapter } from "./mock.ts"

test("fetchCatalogPage paginates and terminates", async () => {
  const page1 = await mockProviderAdapter.fetchCatalogPage(null)
  assert.equal(page1.listings.length, 12)
  assert.equal(page1.nextCursor, "12")

  const page2 = await mockProviderAdapter.fetchCatalogPage(page1.nextCursor)
  assert.equal(page2.listings.length, 12)
  assert.equal(page2.nextCursor, null)
})

test("normalize maps the supplier's raw shape into PETORA's common fields", () => {
  const raw = {
    itemId: "MOCK-DOG-001",
    title: "Wild Coast Salmon Dog Food, 24lb",
    unitPriceUsd: 42.99,
    qtyOnHand: 180,
    freightUsd: 4.5,
    vendorName: "Wild Coast Provisions",
  }

  const normalized = mockProviderAdapter.normalize(raw)

  assert.equal(normalized.supplierSku, "MOCK-DOG-001")
  assert.equal(normalized.name, "Wild Coast Salmon Dog Food, 24lb")
  assert.equal(normalized.priceCents, 4299)
  assert.equal(normalized.stock, 180)
  assert.equal(normalized.shippingCents, 450)
  assert.equal(normalized.supplier, "Wild Coast Provisions")
})

test("fetchStock rejects an unknown SKU", async () => {
  await assert.rejects(() => mockProviderAdapter.fetchStock("NOT-A-REAL-SKU"))
})

test("placeOrder succeeds within available stock", async () => {
  const ref = await mockProviderAdapter.placeOrder({ supplierSku: "MOCK-CAT-007", quantity: 2 })
  assert.equal(ref.status, "placed")
  assert.match(ref.providerOrderId, /^MOCK-PO-MOCK-CAT-007-\d+$/)
})

test("placeOrder fails when quantity exceeds stock", async () => {
  const ref = await mockProviderAdapter.placeOrder({ supplierSku: "MOCK-CAT-008", quantity: 999 })
  assert.equal(ref.status, "failed")
  assert.equal(ref.providerOrderId, "")
})
