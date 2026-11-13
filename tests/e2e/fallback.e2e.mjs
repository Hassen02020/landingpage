// Phase A — parcours de secours et ancres sur un VRAI serveur Next (build de production) branché sur le faux Supabase.
//   npm run build && FAKE_TENANT=1 bash tests/e2e/run-fake.sh tests/e2e/fallback.e2e.mjs
// Prouve le comportement réel des redirections, du statut HTTP 404 et des ancres. Ne prouve rien sur Netlify / Vercel (NON VÉRIFIÉ).
import { createRequire } from "node:module"
import { createFakeSupabase } from "./fake-supabase.mjs"
const { chromium } = createRequire(import.meta.url)("playwright")

const BASE = process.argv[2] || "http://localhost:3458"
const fake = createFakeSupabase({ tenant: true })
await fake.listen(54321)
let failed = 0
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${ok || !extra ? "" : ` — ${extra}`}`)
  if (!ok) failed++
}
const head = (path) => fetch(`${BASE}${path}`, { redirect: "manual" })

// 1. redirections de secours (sans suivre la redirection : on lit le statut et l'en-tête Location)
let r = await head("/c/slug-inconnu?utm_source=facebook&utm_campaign=x")
check("/c/slug-inconnu?utm… → redirection (307/308)", [307, 308].includes(r.status), String(r.status))
const loc = r.headers.get("location") || ""
check("… vers /voyages-organises avec les UTM conservés", new URL(loc, BASE).pathname === "/voyages-organises" && loc.includes("utm_source=facebook") && loc.includes("utm_campaign=x"), loc)
r = await head("/c/slug-inconnu")
check("/c/slug-inconnu sans paramètre → /voyages-organises sans « ? »", new URL(r.headers.get("location") || "/", BASE).search === "", r.headers.get("location") || "")
r = await head("/o/entreprise-inconnue?utm_source=tiktok&ttclid=Z")
const locO = r.headers.get("location") || ""
check("/o/entreprise-inconnue → redirection vers l'accueil avec les paramètres", [307, 308].includes(r.status) && new URL(locO, BASE).pathname === "/" && locO.includes("ttclid=Z"), `${r.status} ${locO}`)
r = await head("/c/omra-2027?utm_source=facebook&utm_campaign=x")
check("NON-RÉGRESSION /c/omra-2027?utm… → /omra avec les UTM", new URL(r.headers.get("location") || "/", BASE).pathname === "/omra" && (r.headers.get("location") || "").includes("utm_campaign=x"), r.headers.get("location") || "")
r = await head("/omra?utm_source=facebook&utm_campaign=x")
check("NON-RÉGRESSION /omra?utm… → 200, aucune redirection", r.status === 200, String(r.status))
r = await head("/o/easy2book")
check("NON-RÉGRESSION /o/easy2book → accueil", [307, 308].includes(r.status) && new URL(r.headers.get("location") || "", BASE).pathname === "/")

// 2. 404 global : statut réel 404 (jamais 200), page de secours (pas une page blanche)
r = await head("/page-qui-nexiste-pas")
const body404 = await r.text()
check("URL inexistante → statut HTTP 404", r.status === 404, String(r.status))
check("… avec la page de secours (titre, retour accueil, WhatsApp)", body404.includes("n&#x27;existe pas") && body404.includes("Retour à l&#x27;accueil") && body404.includes("wa.me/"), body404.slice(0, 120))
check("… en noindex (ne pollue pas le référencement)", /<meta name="robots" content="noindex/.test(body404))
r = await head("/c/a/b/c")
check("chemin à plusieurs segments (sans secours) → 404, pas de redirection", r.status === 404, String(r.status))

// 3. HTML rendu : ancres présentes
let html = await (await fetch(`${BASE}/voyages-organises`)).text()
const voyageIds = Array.from(html.matchAll(/<article id="(voyage-[a-z0-9-]+)"/g)).map((m) => m[1])
check("/voyages-organises : cartes avec ancre #voyage-<id> dans le HTML rendu", voyageIds.length > 0, String(voyageIds.length))
check("… ancres uniques", new Set(voyageIds).size === voyageIds.length)
html = await (await fetch(`${BASE}/summer-vibes`)).text()
const hotelIds = Array.from(html.matchAll(/<li id="(hotel-[a-z0-9-]+)"/g)).map((m) => m[1])
check("/summer-vibes : cartes avec ancre #hotel-<slug> dans le HTML rendu", hotelIds.length > 0, String(hotelIds.length))
check("… ancres uniques", new Set(hotelIds).size === hotelIds.length)

// 4. navigateur : 404 avec campagne conservée sur « Retour à l'accueil », ancre qui amène à la carte
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" })
const page = await ctx.newPage()
const errors = []
page.on("pageerror", (e) => errors.push(e.message))
const resp = await page.goto(`${BASE}/inexistant?utm_source=facebook&utm_campaign=omra-ramadan-2027&foo=1`, { waitUntil: "networkidle" })
check("navigateur : 404 affichée", resp.status() === 404 && (await page.getByRole("heading", { name: /n'existe pas/ }).isVisible()))
const home = await page.getByRole("link", { name: "Retour à l'accueil" }).getAttribute("href")
check("« Retour à l'accueil » conserve les UTM (et seulement les paramètres de suivi)", home.includes("utm_source=facebook") && home.includes("utm_campaign=omra-ramadan-2027") && !home.includes("foo=1"), home)
check("bouton WhatsApp présent", (await page.getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).startsWith("https://wa.me/"))
await page.goto(`${BASE}/voyages-organises#${voyageIds[0]}`, { waitUntil: "networkidle" })
const target = page.locator(`#${voyageIds[0]}`)
check("ancre : la carte ciblée existe et est visible à l'écran", (await target.count()) === 1 && (await target.isVisible()))
const box = await target.boundingBox()
check("ancre : le navigateur a fait défiler jusqu'à la carte", box !== null && box.y < 844 && box.y > -50, JSON.stringify(box))
check("aucune erreur JavaScript", errors.length === 0, errors.join(" | "))
await browser.close()
await fake.close?.()
console.log(failed ? `\n${failed} échec(s)` : "\nparcours de secours OK")
process.exit(failed ? 1 : 0)
