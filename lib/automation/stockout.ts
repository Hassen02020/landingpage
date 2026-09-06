type InventoryRow = { quantity_available: number | null } | { quantity_available: number | null }[] | null

type VariantRow = { id: string; inventory: InventoryRow }

export type StockoutCandidate = { id: string; product_variants: VariantRow[] | null }

/**
 * A product qualifies for pause_on_stockout once every one of its variants
 * has zero (or missing) available stock. A product with no variants at all
 * is left alone — that's a data-completeness problem, not a stockout.
 */
export function selectOutOfStockProductIds(products: StockoutCandidate[]): string[] {
  return products
    .filter((p) => {
      const variants = p.product_variants ?? []
      if (variants.length === 0) return false
      return variants.every((v) => {
        const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory
        return (inv?.quantity_available ?? 0) <= 0
      })
    })
    .map((p) => p.id)
}
