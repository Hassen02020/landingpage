// Audit navigateur de TOUS les liens WhatsApp des pages publiques : numéro unique, message présent,
// référence E2B ajoutée au clic, événement « Contact » envoyé SEULEMENT avec consentement.
// Un clic prouve l'intention, pas l'envoi du message : aucune conversation n'est simulée.
//   bash tests/e2e/run-public.sh tests/e2e/whatsapp.e2e.mjs
import { createRequire } from "node:module"
const { chromium } = createRequire(import.meta.url)("playwright")

const BASE = process.argv[2] || "http://localhost:3456"
const NUMBER = "21698140514" // lib/config.ts : WHATSAPP_NUMBER (source unique)
let failed = 0
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${ok || !extra ? "" : ` — ${extra}`}`)
  if (!ok) failed++
}
const PAGES = [["accueil", "/"], ["Omra", "/omra"], ["voyages organisés", "/voyages-organises"], ["hôtels", "/summer-vibes"]]
const label$ = (a, i) => a.evaluate((el) => (el.innerText || el.getAttribute('aria-label') || el.getAttribute('href') || '').replace(/\s+/g, ' ').trim().slice(0, 28)).catch(() => `#${i}`)
// Clic « au doigt » : au centre du PREMIER fragment de texte du lien (un lien qui passe à la ligne a une zone englobante trompeuse).
async function tap(a) {
  await a.scrollIntoViewIfNeeded().catch(() => {})
  const pt = await a.evaluate((el) => {
    const r = [...el.getClientRects()].find((x) => x.width > 2 && x.height > 2)
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
  })
  if (pt) await a.page().mouse.click(pt.x, pt.y)
}
const browser = await chromium.launch()

for (const consent of [true, false]) {
  for (const [label, path] of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    const tracked = []
    await page.route("**/api/track", async (r) => {
      try { tracked.push(JSON.parse(r.request().postData())) } catch { /* ignore */ }
      await r.fulfill({ json: { ok: true } })
    })
    // aucune requête vers WhatsApp : bloqué au niveau du contexte (couvre aussi les fenêtres ouvertes par un clic)
    await ctx.route(/^https:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\//, (r) => r.fulfill({ body: "wa" }))
    await page.goto(`${BASE}${path}?utm_source=instagram&utm_medium=bio&utm_campaign=bio`, { waitUntil: "networkidle" })
    const btn = page.getByRole("button", { name: consent ? /قبول|Accepter/ : /رفض|Refuser/ })
    if (await btn.count()) await btn.first().click()
    await page.waitForTimeout(500)

    const hrefs = await page.locator('a[href*="wa.me"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")))
    const wrongNumber = hrefs.filter((h) => !h.startsWith(`https://wa.me/${NUMBER}`))
    const tag = `${label} (${consent ? "avec" : "sans"} consentement)`
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}]/u
    const withEmoji = hrefs.filter((h) => emojiRe.test(decodeURIComponent((h.split("text=")[1] || "").replace(/\+/g, " "))))
    check(`${tag} : aucun emoji dans les textes préremplis (wa.me les remplace par « � »)`, withEmoji.length === 0, withEmoji.map((h) => h.slice(0, 80)).join(" | "))
    check(`${tag} : ${hrefs.length} lien(s) WhatsApp, tous vers le numéro officiel`, hrefs.length > 0 && wrongNumber.length === 0, wrongNumber.join(" | "))

    const n = await page.locator('a[href*="wa.me"]').count()
    const noRef = [], untracked = []
    for (let i = 0; i < n; i++) {
      const a = page.locator('a[href*="wa.me"]').nth(i)
      if (!(await a.isVisible())) continue
      const before = tracked.length
      const [popup] = await Promise.all([ctx.waitForEvent("page", { timeout: 4000 }).catch(() => null), tap(a)])
      if (popup) await popup.waitForURL(/wa\.me/, { timeout: 4000 }).catch(() => {})
      else await page.waitForURL(/wa\.me/, { timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(200)
      const target = (popup ? popup.url() : page.url()).replace(/\+/g, " ")
      if (popup) await popup.close()
      else if (/wa\.me/.test(page.url())) await page.goBack({ waitUntil: "networkidle" }).catch(() => {})
      if (!/R%C3%A9f%3A%20E2B-[A-Z0-9]{6}|Réf: E2B-[A-Z0-9]{6}|R%C3%A9f%3A\+E2B-/.test(decodeURIComponent(target)) && !/Réf: E2B-[A-Z0-9]{6}/.test(decodeURIComponent(target))) noRef.push(await label$(a, i))
      if (!tracked.slice(before).some((e) => e.eventName === "Contact")) untracked.push(await label$(a, i))
    }
    if (consent) {
      check(`${tag} : chaque clic ajoute la référence E2B au message`, noRef.length === 0, `sans référence : ${noRef.join(", ")}`)
      check(`${tag} : chaque clic envoie un événement « Contact »`, untracked.length === 0, `non suivis : ${untracked.join(", ")}`)
    } else {
      check(`${tag} : la référence est ajoutée (rattachement) mais AUCUN événement n'est envoyé`, noRef.length === 0 && tracked.filter((e) => e.eventName === "Contact" && e.consent === "granted").length === 0, `sans référence : ${noRef.join(", ")} ; envoyés : ${tracked.length}`)
    }
    await ctx.close()
  }
}
await browser.close()
console.log(failed ? `\n${failed} échec(s)` : "\nliens WhatsApp OK")
process.exit(failed ? 1 : 0)
