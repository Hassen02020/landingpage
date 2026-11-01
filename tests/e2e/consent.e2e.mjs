// Test navigateur (Playwright) du consentement — à lancer contre `npm start` :
//   PORT=3456 npm start &   puis   node tests/e2e/consent.e2e.mjs http://localhost:3456
import { createRequire } from "node:module"
// playwright est résolu depuis l'installation globale (NODE_PATH) ou locale
const { chromium } = createRequire(import.meta.url)("playwright")

const BASE = process.argv[2] || "http://localhost:3456"
const results = []
const check = (name, ok) => { results.push([name, ok]); console.log(`${ok ? "✓" : "✗"} ${name}`) }

const browser = await chromium.launch()
const ctx = await browser.newContext()
const thirdParty = []
const api = []
await ctx.route(/^https:\/\/(connect\.facebook\.net|www\.facebook\.com|analytics\.tiktok\.com)\//, (r) => { thirdParty.push(r.request().url()); r.fulfill({ body: "" }) })
await ctx.route(/^https:\/\/(images\.unsplash\.com)\//, (r) => r.fulfill({ body: "" }))
await ctx.route(/^https:\/\/wa\.me\//, (r) => r.fulfill({ body: "wa" }))
const page = await ctx.newPage()
page.on("request", (r) => { if (r.url().includes("/api/")) api.push({ url: new URL(r.url()).pathname, body: r.postData() }) })

// 1. Arrivée depuis une pub, sans choix de consentement
await page.goto(`${BASE}/omra?utm_source=facebook&utm_campaign=e2e&fbclid=FB_E2E`, { waitUntil: "networkidle" })
check("bandeau de consentement affiché", await page.getByRole("dialog", { name: "Consentement cookies" }).isVisible())
check("aucun script Meta/TikTok chargé avant consentement", thirdParty.length === 0)
check("aucun cookie _fbc posé avant consentement", !(await ctx.cookies()).some((c) => c.name === "_fbc"))
check("attribution gardée en session uniquement", (await page.evaluate(() => [localStorage.getItem("e2b_lt"), sessionStorage.getItem("e2b_lt")])).every((v, i) => (i === 0 ? v === null : Boolean(v?.includes('"utm_campaign":"e2e"')))))

// clic WhatsApp sans consentement
const [p1] = await Promise.all([ctx.waitForEvent("page"), page.click('section#top a[href*="wa.me"]')])
await p1.waitForURL(/wa\.me/)
check("message WhatsApp avec référence même sans consentement", new URL(p1.url()).searchParams.get("text").includes("Réf: E2B-"))
await p1.close()
await page.waitForTimeout(300)
check("aucun appel /api/track sans consentement", !api.some((a) => a.url === "/api/track"))

// 2. Acceptation
await page.getByRole("button", { name: "قبول" }).click()
await page.waitForTimeout(800)
check("script Meta chargé après acceptation", thirdParty.some((u) => u.includes("connect.facebook.net")))
check("cookie _fbc créé depuis fbclid après acceptation", (await ctx.cookies()).some((c) => c.name === "_fbc" && c.value.endsWith("FB_E2E")))

const [p2] = await Promise.all([ctx.waitForEvent("page"), page.click('section#top a[href*="wa.me"]')])
await p2.close()
await page.waitForTimeout(500)
const track = api.find((a) => a.url === "/api/track" && a.body.includes('"Contact"'))
check("/api/track appelé avec consent=granted après acceptation", Boolean(track) && JSON.parse(track.body).consent === "granted")

// 3. Formulaire
await page.fill("#omra-lead-form input[name=name]", "Test E2E")
await page.fill("#omra-lead-form input[name=phone]", "22123456")
await page.check("#omra-lead-form input[name=consent]")
await page.click("#omra-lead-form button[type=submit]")
await page.waitForTimeout(1500)
const lead = api.find((a) => a.url === "/api/leads")
const leadBody = lead ? JSON.parse(lead.body) : {}
check("formulaire : trackingConsent=true, marketingConsent=false par défaut", leadBody.trackingConsent === true && leadBody.marketingConsent === false)
check("formulaire : redirection vers WhatsApp", page.url().startsWith("https://wa.me/"))

await browser.close()
const failed = results.filter(([, ok]) => !ok).length
console.log(`\n${results.length - failed} réussis, ${failed} échoués`)
process.exit(failed ? 1 : 0)
