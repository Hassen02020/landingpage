import type { ProviderAdapter } from "./types"
import { mockProviderAdapter } from "./mock"

const ADAPTERS: Record<string, ProviderAdapter> = {
  mock: mockProviderAdapter,
}

/**
 * Looks up the adapter for a provider code. Throws (rather than falling
 * back to anything) for a provider seeded as 'coming_soon' — see
 * migration 0011 and the architecture doc, §5: eBay/Amazon SP-API/Alibaba
 * are registered as known future providers, not implemented ones.
 */
export function getProviderAdapter(code: string): ProviderAdapter {
  const adapter = ADAPTERS[code]
  if (!adapter) {
    throw new Error(`No adapter implemented yet for provider "${code}".`)
  }
  return adapter
}
