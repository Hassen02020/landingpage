// Parcours de réservation Omra (mobile) — sans écriture en base : /api/leads et /api/track sont simulés.
//   npm run build && PORT=3456 npm start &   puis   node tests/e2e/omra-journey.e2e.mjs http://localhost:3456
import { createRequire } from "node:module"
const { chromium } = createRequire(import.meta.url)("playwright")

const BASE = process.argv[2] || "http://localhost:3456"
let failed = 0
const check = (label, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`)
  if (!ok) failed++
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-TN" })
const page = await ctx.newPage()
const errors = []
page.on("pageerror", (e) => errors.push(e.message))
let lead = null
await page.route("**/api/leads", async (r) => {
  lead = JSON.parse(r.request().postData())
  await r.fulfill({ json: { ok: true, ref: "E2B-TEST01", stored: true, whatsappUrl: "https://wa.me/21698140514?text=R%C3%A9f%3A%20E2B-TEST01" } })
})
await page.route("**/api/track", (r) => r.fulfill({ json: { ok: true } }))
await page.route("https://wa.me/**", (r) => r.fulfill({ body: "wa" }))

await page.goto(`${BASE}/omra`, { waitUntil: "networkidle" })
check("aucune erreur JavaScript / d'hydratation", errors.length === 0)
check("pas de texte français sur la page arabe", !(await page.locator("body").innerText()).match(/par personne|nuits|inclus|Réserver/))
await page.getByRole("button", { name: "رفض" }).click()

await page.getByRole("button", { name: "احجز هذا الفوج" }).nth(1).click()
await page.waitForTimeout(900)
check("« احجز هذا الفوج » pré-remplit le fuseau choisi", (await page.locator("#omra-lead-form select[name=offer]").inputValue()) === "الفوج الثاني — 18 فيفري 2027")
check("le formulaire est affiché à l'écran", await page.locator("#omra-lead-form").evaluate((e) => e.getBoundingClientRect().top < innerHeight))
check("pas de champ date (départs fixes)", (await page.locator("#omra-lead-form input[name=travel_date]").count()) === 0)

await page.fill("#omra-lead-form input[name=name]", "Test Parcours")
await page.fill("#omra-lead-form input[name=phone]", "98140514")
await page.check("#omra-lead-form input[name=consent]")
await Promise.all([page.waitForURL(/wa\.me/, { timeout: 10000 }), page.click("#omra-lead-form button[type=submit]")])
check("lead envoyé avec produit, fuseau et niche — sans voyageurs ni budget (qualification plus tard)", lead?.product === "omra" && lead?.offer === "الفوج الثاني — 18 فيفري 2027" && lead?.niche === "omra-ramadan-2027" && lead?.adults === undefined && lead?.budget === undefined)
check("redirection WhatsApp avec la référence CRM", decodeURIComponent(page.url()).includes("Réf: E2B-TEST01"))

await page.goto(`${BASE}/omra`, { waitUntil: "networkidle" })
const wa = decodeURIComponent((await page.getByText("أو اسأل على واتساب").first().getAttribute("href")) || "")
check("lien WhatsApp d'un fuseau : message arabe avec fuseau, durée et prix", wa.includes("الفوج الأول — 27 جانفي 2027") && wa.includes("14 ليلة") && wa.includes("5500"))
check("barre d'action mobile visible", await page.locator(".fixed.bottom-0 >> text=احجز مكانك").isVisible())

await browser.close()
console.log(failed ? `\n${failed} échec(s)` : "\nparcours OK")
process.exit(failed ? 1 : 0)
