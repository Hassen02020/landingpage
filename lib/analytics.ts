"use client"

// Thin wrapper around GA4 (gtag), Meta Pixel (fbq) and TikTok Pixel (ttq).
// Each call is a no-op if that pixel's script isn't loaded (env var unset),
// so marketing events are safe to fire from anywhere without feature checks.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
    ttq?: { track: (event: string, data?: Record<string, unknown>) => void }
  }
}

type CommerceItem = {
  id: string
  name: string
  priceCents: number
  quantity?: number
}

function toGa4Items(items: CommerceItem[]) {
  return items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.priceCents / 100, quantity: i.quantity ?? 1 }))
}

export function trackPageView(url: string) {
  if (typeof window === "undefined") return
  window.gtag?.("event", "page_view", { page_path: url })
  window.fbq?.("track", "PageView")
}

export function trackViewContent(item: CommerceItem) {
  if (typeof window === "undefined") return
  window.gtag?.("event", "view_item", { currency: "USD", value: item.priceCents / 100, items: toGa4Items([item]) })
  window.fbq?.("track", "ViewContent", { content_ids: [item.id], content_name: item.name, value: item.priceCents / 100, currency: "USD" })
  window.ttq?.track("ViewContent", { content_id: item.id, value: item.priceCents / 100, currency: "USD" })
}

export function trackSearch(query: string) {
  if (typeof window === "undefined") return
  window.gtag?.("event", "search", { search_term: query })
  window.fbq?.("track", "Search", { search_string: query })
}

export function trackAddToCart(item: CommerceItem) {
  if (typeof window === "undefined") return
  window.gtag?.("event", "add_to_cart", { currency: "USD", value: item.priceCents / 100, items: toGa4Items([item]) })
  window.fbq?.("track", "AddToCart", { content_ids: [item.id], value: item.priceCents / 100, currency: "USD" })
  window.ttq?.track("AddToCart", { content_id: item.id, value: item.priceCents / 100, currency: "USD" })
}

export function trackInitiateCheckout(items: CommerceItem[], valueCents: number) {
  if (typeof window === "undefined") return
  window.gtag?.("event", "begin_checkout", { currency: "USD", value: valueCents / 100, items: toGa4Items(items) })
  window.fbq?.("track", "InitiateCheckout", {
    content_ids: items.map((i) => i.id),
    value: valueCents / 100,
    currency: "USD",
  })
  window.ttq?.track("InitiateCheckout", { value: valueCents / 100, currency: "USD" })
}

export function trackAddPaymentInfo(valueCents: number) {
  if (typeof window === "undefined") return
  window.gtag?.("event", "add_payment_info", { currency: "USD", value: valueCents / 100 })
  window.fbq?.("track", "AddPaymentInfo", { value: valueCents / 100, currency: "USD" })
}

export function trackPurchase(orderId: string, valueCents: number, items: CommerceItem[]) {
  if (typeof window === "undefined") return
  window.gtag?.("event", "purchase", {
    transaction_id: orderId,
    currency: "USD",
    value: valueCents / 100,
    items: toGa4Items(items),
  })
  window.fbq?.("track", "Purchase", { value: valueCents / 100, currency: "USD", content_ids: items.map((i) => i.id) })
  window.ttq?.track("Purchase", { value: valueCents / 100, currency: "USD" })
}
