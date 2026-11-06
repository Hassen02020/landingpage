import { describe, expect, it } from "vitest"
import nextConfig from "../next.config.mjs"

// Contrôle de la configuration des en-têtes de sécurité (le rendu réel est vérifié en e2e).
describe("en-têtes de sécurité HTTP", () => {
  it("toutes les pages : nosniff, referrer, permissions ; /admin : DENY, no-store, noindex", async () => {
    const rules = await (nextConfig as { headers: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]> }).headers()
    const all = Object.fromEntries(rules.find((r) => r.source === "/:path*")!.headers.map((h) => [h.key, h.value]))
    expect(all["X-Content-Type-Options"]).toBe("nosniff")
    expect(all["Referrer-Policy"]).toBe("strict-origin-when-cross-origin")
    expect(all["Permissions-Policy"]).toContain("camera=()")
    const admin = Object.fromEntries(rules.find((r) => r.source === "/admin/:path*")!.headers.map((h) => [h.key, h.value]))
    expect(admin["X-Frame-Options"]).toBe("DENY")
    expect(admin["Cache-Control"]).toContain("no-store")
    expect(admin["X-Robots-Tag"]).toContain("noindex")
  })
})
