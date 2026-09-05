import type { CatalogPage, NormalizedListing, ProviderAdapter, ProviderOrderRef, RawListing, RoutedOrderLine, StockLevel } from "./types"

/**
 * Deterministic stand-in for a real supplier feed. Field names are
 * deliberately unlike PETORA's own schema (itemId/title/unitPriceUsd/...)
 * so normalize() below is doing real work, not a pass-through — the same
 * shape mismatch any real adapter (eBay, Amazon SP-API, Alibaba) would face.
 */
const MOCK_CATALOG: RawListing[] = [
  { itemId: "MOCK-DOG-001", title: "Wild Coast Salmon Dog Food, 24lb", unitPriceUsd: 42.99, qtyOnHand: 180, freightUsd: 4.5, vendorName: "Wild Coast Provisions" },
  { itemId: "MOCK-DOG-002", title: "Northgate Grain-Free Turkey Kibble, 15lb", unitPriceUsd: 34.5, qtyOnHand: 96, freightUsd: 3.75, vendorName: "Northgate Pet Traders" },
  { itemId: "MOCK-DOG-003", title: "Loyal Paws Freeze-Dried Beef Treats, 6oz", unitPriceUsd: 12.99, qtyOnHand: 340, freightUsd: 0, vendorName: "Loyal Paws Wholesale" },
  { itemId: "MOCK-DOG-004", title: "Harborline Orthopedic Dog Bed, Large", unitPriceUsd: 58.0, qtyOnHand: 42, freightUsd: 9.99, vendorName: "Harborline Home Goods" },
  { itemId: "MOCK-DOG-005", title: "Wild Coast Duck & Pea Wet Food, 12-pack", unitPriceUsd: 28.75, qtyOnHand: 210, freightUsd: 5.25, vendorName: "Wild Coast Provisions" },
  { itemId: "MOCK-DOG-006", title: "Northgate Puppy Starter Kibble, 10lb", unitPriceUsd: 26.0, qtyOnHand: 130, freightUsd: 3.5, vendorName: "Northgate Pet Traders" },
  { itemId: "MOCK-DOG-007", title: "Loyal Paws Rope & Rubber Chew Bundle", unitPriceUsd: 15.5, qtyOnHand: 275, freightUsd: 2.0, vendorName: "Loyal Paws Wholesale" },
  { itemId: "MOCK-DOG-008", title: "Harborline No-Pull Dog Harness, Medium", unitPriceUsd: 21.99, qtyOnHand: 88, freightUsd: 3.0, vendorName: "Harborline Home Goods" },
  { itemId: "MOCK-DOG-009", title: "Wild Coast Senior Joint-Support Kibble, 20lb", unitPriceUsd: 46.25, qtyOnHand: 60, freightUsd: 4.75, vendorName: "Wild Coast Provisions" },
  { itemId: "MOCK-DOG-010", title: "Northgate Sensitive Stomach Wet Food, 12-pack", unitPriceUsd: 31.0, qtyOnHand: 150, freightUsd: 5.0, vendorName: "Northgate Pet Traders" },
  { itemId: "MOCK-DOG-011", title: "Loyal Paws Dental Chew Sticks, 30-count", unitPriceUsd: 18.25, qtyOnHand: 190, freightUsd: 2.5, vendorName: "Loyal Paws Wholesale" },
  { itemId: "MOCK-DOG-012", title: "Harborline Reflective Leash, 6ft", unitPriceUsd: 13.0, qtyOnHand: 320, freightUsd: 1.75, vendorName: "Harborline Home Goods" },
  { itemId: "MOCK-CAT-001", title: "Wild Coast Whitefish Cat Kibble, 12lb", unitPriceUsd: 29.99, qtyOnHand: 140, freightUsd: 3.25, vendorName: "Wild Coast Provisions" },
  { itemId: "MOCK-CAT-002", title: "Northgate Grain-Free Chicken Cat Food, 10lb", unitPriceUsd: 27.5, qtyOnHand: 175, freightUsd: 3.0, vendorName: "Northgate Pet Traders" },
  { itemId: "MOCK-CAT-003", title: "Loyal Paws Freeze-Dried Salmon Cat Treats, 4oz", unitPriceUsd: 10.99, qtyOnHand: 260, freightUsd: 0, vendorName: "Loyal Paws Wholesale" },
  { itemId: "MOCK-CAT-004", title: "Harborline Clumping Clay Litter, 40lb", unitPriceUsd: 19.5, qtyOnHand: 205, freightUsd: 6.5, vendorName: "Harborline Home Goods" },
  { itemId: "MOCK-CAT-005", title: "Wild Coast Tuna Pate Wet Food, 24-pack", unitPriceUsd: 33.0, qtyOnHand: 118, freightUsd: 5.75, vendorName: "Wild Coast Provisions" },
  { itemId: "MOCK-CAT-006", title: "Northgate Kitten Growth Formula, 7lb", unitPriceUsd: 24.99, qtyOnHand: 90, freightUsd: 2.75, vendorName: "Northgate Pet Traders" },
  { itemId: "MOCK-CAT-007", title: "Loyal Paws Feather Wand Cat Toy, 3-pack", unitPriceUsd: 9.5, qtyOnHand: 400, freightUsd: 1.25, vendorName: "Loyal Paws Wholesale" },
  { itemId: "MOCK-CAT-008", title: "Harborline Cat Scratching Post, 32in", unitPriceUsd: 44.0, qtyOnHand: 35, freightUsd: 8.5, vendorName: "Harborline Home Goods" },
  { itemId: "MOCK-CAT-009", title: "Wild Coast Indoor Hairball Control Kibble, 8lb", unitPriceUsd: 25.75, qtyOnHand: 165, freightUsd: 2.5, vendorName: "Wild Coast Provisions" },
  { itemId: "MOCK-CAT-010", title: "Northgate Senior Cat Wet Food, 24-pack", unitPriceUsd: 35.5, qtyOnHand: 72, freightUsd: 5.5, vendorName: "Northgate Pet Traders" },
  { itemId: "MOCK-CAT-011", title: "Loyal Paws Silvervine Chew Sticks, 10-count", unitPriceUsd: 8.25, qtyOnHand: 310, freightUsd: 0, vendorName: "Loyal Paws Wholesale" },
  { itemId: "MOCK-CAT-012", title: "Harborline Covered Litter Box, Jumbo", unitPriceUsd: 39.99, qtyOnHand: 54, freightUsd: 7.25, vendorName: "Harborline Home Goods" },
]

const PAGE_SIZE = 12

function cents(dollars: number): number {
  return Math.round(dollars * 100)
}

function findRaw(supplierSku: string): RawListing | undefined {
  return MOCK_CATALOG.find((r) => r.itemId === supplierSku)
}

export const mockProviderAdapter: ProviderAdapter = {
  code: "mock",

  async fetchCatalogPage(cursor): Promise<CatalogPage> {
    const start = cursor ? Number.parseInt(cursor, 10) : 0
    const end = start + PAGE_SIZE
    const listings = MOCK_CATALOG.slice(start, end)
    const nextCursor = end < MOCK_CATALOG.length ? String(end) : null
    return { listings, nextCursor }
  },

  normalize(raw): NormalizedListing {
    const itemId = String(raw.itemId)
    const title = String(raw.title)
    const unitPriceUsd = Number(raw.unitPriceUsd)
    const qtyOnHand = Number(raw.qtyOnHand)
    const freightUsd = Number(raw.freightUsd)
    const vendorName = String(raw.vendorName)

    return {
      supplierSku: itemId,
      name: title,
      priceCents: cents(unitPriceUsd),
      stock: qtyOnHand,
      shippingCents: cents(freightUsd),
      supplier: vendorName,
      raw,
    }
  },

  async fetchStock(supplierSku): Promise<StockLevel> {
    const raw = findRaw(supplierSku)
    if (!raw) throw new Error(`Mock provider: unknown SKU "${supplierSku}".`)
    return { quantity: Number(raw.qtyOnHand), asOf: new Date().toISOString() }
  },

  async placeOrder(line: RoutedOrderLine): Promise<ProviderOrderRef> {
    const raw = findRaw(line.supplierSku)
    if (!raw || Number(raw.qtyOnHand) < line.quantity) {
      return { providerOrderId: "", status: "failed" }
    }
    return { providerOrderId: `MOCK-PO-${line.supplierSku}-${Date.now()}`, status: "placed" }
  },
}
