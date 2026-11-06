// Aide au diagnostic : liste les éléments qui dépassent à droite de l'écran mobile.
import { createRequire } from "node:module"
import { createFakeSupabase, ADMIN } from "./fake-supabase.mjs"
const { chromium } = createRequire(import.meta.url)("playwright")
const [BASE, ...paths] = process.argv.slice(2)
const fake = createFakeSupabase(); await fake.listen(54321)
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage()
await page.goto(`${BASE}/admin/login`); await page.fill("input[name=email]", ADMIN.email); await page.fill("input[name=password]", ADMIN.password)
await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/login")), page.click("button[type=submit]")])
for (const p of paths) {
  await page.goto(`${BASE}${p}`, { waitUntil: "networkidle" })
  const bad = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest(".overflow-x-auto")).slice(0, 6).map((e) => `${e.tagName}.${String(e.className).slice(0, 60)} → ${Math.round(e.getBoundingClientRect().right)}px`))
  console.log(p, bad.length ? bad : "ok")
}
await b.close(); await fake.close()
