/**
 * How much a supplier's stock moved since the last sync. Returns 0 (no
 * adjustment) when there's no prior reading — see migration 0014: the
 * first sync for a listing only records a baseline, it never guesses at
 * a delta from nothing.
 */
export function computeInventoryDelta(previousSyncedStock: number | null, currentStock: number): number {
  if (previousSyncedStock === null) return 0
  return currentStock - previousSyncedStock
}
