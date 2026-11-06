// Formulaires publics (navigateur réel) : le premier contact reste COURT (décisions du propriétaire).
// Visible au premier contact : prénom/nom, téléphone, produit, offre / destination, consentements.
// Jamais : budget, région, âge, voyageurs, type de séjour, date. L'e-mail est facultatif (absent par défaut).
//   node tests/e2e/collect.e2e.mjs http://localhost:3456
import { createRequire } from "node:module"
const { chromium } = createRequire(import.meta.url)("playwright")

const BASE = process.argv[2] || "http://localhost:3456"
let failed = 0
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${ok || !extra ? "" : ` — ${extra}`}`)
  if (!ok) failed++
}
const ALLOWED = new Set(["name", "phone", "product", "offer", "destination", "consent", "marketing"])
const FORBIDDEN = ["budget", "region", "age", "adults", "children", "trip_type", "travel_date", "travel_period", "email"]

const browser = await chromium.launch()
for (const [label, path, formSel] of [["accueil", "/", "#home-lead-form"], ["Omra", "/omra", "#omra-lead-form"], ["voyages organisés", "/voyages-organises", "#voyage-lead-form"], ["hôtels", "/summer-vibes", "#hotel-lead-form"]]) {
  for (const [dev, vp] of [["mobile", { width: 390, height: 844 }], ["bureau", { width: 1366, height: 860 }]]) {
    const ctx = await browser.newContext({ viewport: vp })
    const page = await ctx.newPage()
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" })
    // visibilité réelle (les champs du bloc « facultatif » replié ne comptent pas)
    const controls = page.locator(`${formSel} input:not([type=hidden]), ${formSel} select, ${formSel} textarea`)
    const names = []
    for (let i = 0; i < (await controls.count()); i++) {
      const c = controls.nth(i)
      if (await c.isVisible()) names.push(await c.getAttribute("name"))
    }
    const unexpected = names.filter((n) => n && !ALLOWED.has(n))
    check(`${label} (${dev}) : champs visibles = prénom, téléphone, offre, consentements`, names.includes("name") && names.includes("phone") && unexpected.length === 0, `inattendus : ${unexpected.join(", ")}`)
    const html = await page.locator(formSel).innerHTML()
    check(`${label} (${dev}) : aucun champ ${FORBIDDEN.join(" / ")}`, !FORBIDDEN.some((f) => html.includes(`name="${f}"`)))
    check(`${label} (${dev}) : mention « répondre sur WhatsApp »`, /WhatsApp|واتساب/.test(await page.locator(formSel).innerText()))
    await ctx.close()
  }
}
// Soumission minimale (prénom + téléphone + consentement) : accepté, WhatsApp privilégié
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  let payload = null
  await page.route("**/api/leads", async (r) => {
    payload = JSON.parse(r.request().postData())
    await r.fulfill({ json: { ok: true, ref: "E2B-TEST01", stored: true, whatsappUrl: "https://wa.me/21698140514?text=R%C3%A9f%3A%20E2B-TEST01" } })
  })
  await page.route("**/api/track", (r) => r.fulfill({ json: { ok: true } }))
  await page.route("https://wa.me/**", (r) => r.fulfill({ body: "wa" }))
  await page.goto(`${BASE}/voyages-organises`, { waitUntil: "networkidle" })
  const refuse = page.getByRole("button", { name: "Refuser" })
  if (await refuse.count()) await refuse.click()
  await page.fill("#voyage-lead-form input[name=name]", "Mariem")
  await page.fill("#voyage-lead-form input[name=phone]", "98 765 432")
  await page.check("#voyage-lead-form input[name=consent]")
  await Promise.all([page.waitForURL(/wa\.me/, { timeout: 10000 }), page.click("#voyage-lead-form button[type=submit]")])
  check("soumission minimale : prénom + téléphone + consentement suffisent", payload?.name === "Mariem" && payload?.phone === "98765432" && payload?.contactConsent === true)
  check("soumission minimale : aucun e-mail, voyageurs, budget ni région envoyés", ["email", "adults", "children", "budget", "region", "travel_date"].every((k) => payload?.[k] === undefined))
  check("soumission minimale : le visiteur est redirigé vers WhatsApp avec la référence", decodeURIComponent(page.url()).includes("Réf: E2B-TEST01"))
  await ctx.close()
}
await browser.close()
console.log(failed ? `\n${failed} échec(s)` : "\ncollecte OK")
process.exit(failed ? 1 : 0)
