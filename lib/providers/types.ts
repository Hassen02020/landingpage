/**
 * Provider Connector Engine — the adapter contract every supplier
 * integration implements. See PETORA Commerce OS architecture, §5:
 * https://claude.ai/code/session_01A19xNgqjcAYdFFkQ5KgvTP
 *
 * Every provider speaks its own shape (`RawListing` is deliberately
 * untyped) — `normalize()` is the one place that shape gets translated
 * into PETORA's common fields. Nothing downstream of catalog_staging
 * ever needs to know which supplier a listing came from.
 */

export type RawListing = Record<string, unknown>

export type NormalizedListing = {
  supplierSku: string
  name: string
  priceCents: number
  stock: number
  shippingCents: number
  supplier: string
  raw: RawListing
}

export type CatalogPage = {
  listings: RawListing[]
  /** Opaque pagination token. Null means this was the last page. */
  nextCursor: string | null
}

export type StockLevel = {
  quantity: number
  asOf: string
}

export type RoutedOrderLine = {
  supplierSku: string
  quantity: number
}

export type ProviderOrderRef = {
  providerOrderId: string
  status: "placed" | "failed"
}

export type FulfillmentStatus = {
  status: "processing" | "shipped" | "delivered" | "cancelled"
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
  shippedAt?: string
  deliveredAt?: string
}

export interface ProviderAdapter {
  code: string

  /** Pull one page of the supplier's raw catalog feed. */
  fetchCatalogPage(cursor?: string | null): Promise<CatalogPage>

  /** Map one raw listing into PETORA's common shape. Pure — no I/O. */
  normalize(raw: RawListing): NormalizedListing

  /** Live stock check for one SKU, e.g. before confirming an order. */
  fetchStock(supplierSku: string): Promise<StockLevel>

  /** Place a purchase with the supplier for a routed order line. Exercised by Phase 13 (Order Router). */
  placeOrder(line: RoutedOrderLine): Promise<ProviderOrderRef>

  /**
   * Check how a placed order is progressing at the supplier. Exercised by
   * Phase 14 (Supplier Fulfillment) — the customer-facing tracking page
   * (Phase 15) reads from PETORA's own `shipments` table, not from this
   * call directly; this is what keeps that table's carrier/tracking
   * fields current.
   */
  fetchFulfillmentStatus(providerOrderId: string): Promise<FulfillmentStatus>
}
