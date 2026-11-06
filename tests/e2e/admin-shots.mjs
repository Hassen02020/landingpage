// Captures de toutes les pages /admin (bureau + mobile) avec le faux Supabase.
//   node tests/e2e/admin-shots.mjs http://localhost:3458 /chemin/captures prefixe
import { createRequire } from "node:module"
import { createFakeSupabase, ADMIN } from "./fake-supabase.mjs"
const { chromium } = createRequire(import.meta.url)("playwright")

const [BASE = "http://localhost:3458", DIR = ".", PREFIX = "shot"] = process.argv.slice(2)
const PAGES = [
  ["leads", "/admin"], ["pipeline", "/admin/pipeline"], ["lead", "/admin/leads/00000000-0000-4000-8000-000000000001"],
  ["stats", "/admin/stats"], ["stats-equipe", "/admin/stats?view=equipe"], ["calculateur", "/admin/calculateur"],
  ["catalogue", "/admin/catalogue"], ["offre", "/admin/catalogue/offres/aaaaaaaa-0000-4000-8000-000000000002"], ["promos", "/admin/promos"],
  ["protection", "/admin/protection"], ["integrations", "/admin/integrations"], ["equipe", "/admin/equipe"],
  ["modeles", "/admin/modeles"], ["compte", "/admin/compte"],
]

const fake = createFakeSupabase()
await fake.listen(54321)
const browser = await chromium.launch()
const problems = []
for (const [name, vp] of [["desktop", { width: 1366, height: 860 }], ["mobile", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, locale: "fr-FR" })
  const page = await ctx.newPage()
  page.on("pageerror", (e) => problems.push(`${name} pageerror: ${e.message}`))
  await page.goto(`${BASE}/admin/login`)
  await page.fill("input[name=email]", ADMIN.email)
  await page.fill("input[name=password]", ADMIN.password)
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/login")), page.click("button[type=submit]")])
  for (const [label, path] of PAGES) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" })
    if (!res || res.status() >= 400) problems.push(`${name} ${path} → ${res?.status()}`)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    if (overflow) problems.push(`${name} ${path} : défilement horizontal de la page`)
    await page.screenshot({ path: `${DIR}/${PREFIX}-${name}-${label}.png`, fullPage: false })
  }
  await ctx.close()
}
await browser.close()
await fake.close()
console.log(problems.length ? problems.join("\n") : "aucun problème détecté")
