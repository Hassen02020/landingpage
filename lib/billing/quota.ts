export type QuotaCheck = { allowed: boolean; remaining: number | null }

/**
 * A null limit means unlimited (the Scale plan). `current` is the count
 * *before* the action being gated — the check answers "is there room for
 * one more", not "is the plan already exactly at capacity".
 */
export function checkQuota(current: number, limit: number | null): QuotaCheck {
  if (limit === null) return { allowed: true, remaining: null }
  return { allowed: current < limit, remaining: Math.max(0, limit - current) }
}
