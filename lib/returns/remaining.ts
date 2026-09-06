export type OrderItemQuantity = { id: string; quantity: number }

/**
 * How many units of each order item are still eligible for a new return
 * request: the original quantity minus whatever's already been requested
 * in a non-rejected return. A rejected request frees its quantity back up;
 * anything else (requested, approved, received, refunded, ...) still
 * counts against the total, since it's either pending or already resolved
 * in the customer's favor — not something to double-count a second return
 * against.
 */
export function computeRemainingReturnable(
  orderItems: OrderItemQuantity[],
  alreadyRequestedByItem: Record<string, number>
): Record<string, number> {
  const remaining: Record<string, number> = {}
  for (const item of orderItems) {
    remaining[item.id] = Math.max(0, item.quantity - (alreadyRequestedByItem[item.id] ?? 0))
  }
  return remaining
}
