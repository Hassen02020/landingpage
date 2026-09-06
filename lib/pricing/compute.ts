export type PricingRule = {
  markupType: "percentage" | "fixed_amount"
  markupValue: number
  minMarginCents: number
}

export type ComputedPrice = {
  priceCents: number
  floorApplied: boolean
}

/**
 * Applies a tenant's pricing rule to a supplier cost. Always enforces
 * minMarginCents as a hard floor over the markup — see migration 0013 and
 * the architecture doc §7: a markup percentage alone isn't a safeguard
 * against selling below cost, it just makes the loss proportional instead
 * of fixed.
 */
export function computePrice(costCents: number, rule: PricingRule): ComputedPrice {
  const marked =
    rule.markupType === "percentage"
      ? Math.round(costCents * (1 + rule.markupValue / 100))
      : costCents + Math.round(rule.markupValue)

  const floor = costCents + rule.minMarginCents

  if (marked < floor) {
    return { priceCents: floor, floorApplied: true }
  }
  return { priceCents: marked, floorApplied: false }
}
