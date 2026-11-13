// CHANTIER 1 — Sécurité multi-entreprises des PAGES et des LIENS publicitaires (navigateur réel, site réel, FAUX Supabase multi-entreprises).
//   npm run build && LANDING_ADMIN_API_KEY=<32+ caractères> bash tests/e2e/run-fake.sh tests/e2e/multi-links.e2e.mjs
//
// Deux familles de vérifications :
//   ✓/✗ GARANTIE  : propriété de sécurité qui DOIT être vraie (isolation des prospects, aucune fuite de contenu) → fait échouer le test.
//   ⚠ DÉFAUT      : comportement actuel jugé défaillant par l'audit ; il est CONSTATÉ et présenté, jamais corrigé en silence
//                   (ne fait pas échouer le test ; la liste est imprimée à la fin pour décision).
// Ces essais utilisent un faux Supabase : ils ne prouvent rien sur la production.
import { createRequire } from "node:module"
import { createFakeSupabase, BOB, BOB_ORG, ADMIN } from "./fake-supabase.mjs"
const { chromium } = createRequire(import.meta.url)("playwright")

const BASE = process.argv[2] || "http://localhost:3458"
const fake = createFakeSupabase({ multi: true })
await fake.listen(54321)
const db = fake.db
const E2B = fake.E2B_ORG
let failed = 0
const defects = []
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} GARANTIE — ${label}${ok || !extra ? "" : ` — ${extra}`}`)
  if (!ok) failed++
}
const finding = (label, isDefect, detail = "") => {
  console.log(`${isDefect ? "⚠ DÉFAUT CONSTATÉ" : "✓ non constaté"} — ${label}${detail ? ` — ${detail}` : ""}`)
  if (isDefect) defects.push(`${label}${detail ? ` (${detail})` : ""}`)
}

// ---- données : deux catégories visibles par entreprise, dont UNE adresse identique (collision)
const cat = (org, slug, name) => ({
  id: `cccccccc-${org === E2B ? "e2b0" : "b0b0"}-4000-8000-${String(db.landing_categories.length + 10).padStart(12, "0")}`,
  organization_id: org, slug, name, product: "voyage", lang: "fr", headline: `Titre ${name}`, description: null, banner_desktop: null, banner_mobile: null,
  seo_title: null, seo_description: null, visible: true, position: 0, updated_at: new Date().toISOString(), created_at: new Date().toISOString(),
})
db.landing_categories.push(cat(E2B, "e2b-seulement", "Page Easy2Book Seulement"), cat(E2B, "collision-x", "Collision CHEZ-EASY2BOOK"), cat(BOB_ORG, "bob-ete", "Circuit Bob Été"), cat(BOB_ORG, "collision-x", "Collision CHEZ-BOB"))

const browser = await chromium.launch()
const errors = []
let ip = 0
const newCtx = (extra = {}) => browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR", extraHTTPHeaders: { "x-forwarded-for": `10.77.0.${++ip}` }, ...extra })
async function login(email, password) {
  const ctx = await newCtx({ viewport: { width: 1366, height: 860 } })
  const page = await ctx.newPage()
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(`${BASE}/admin/login`)
  await page.fill("input[name=email]", email)
  await page.fill("input[name=password]", password)
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20000 }), page.click("button[type=submit]")])
  return { ctx, page }
}
const destinations = async (page) => {
  await page.goto(`${BASE}/admin/liens`, { waitUntil: "networkidle" })
  return page.locator('select[aria-label="Page de destination"] option').allInnerTexts()
}
const head = (p) => fetch(`${BASE}${p}`, { redirect: "manual" })

// ================================================================ 1. ce que voit l'entreprise B dans son générateur
const B = await login(BOB.email, BOB.password)
const bobDest = await destinations(B.page)
const bobDestText = bobDest.join(" | ")
check("le générateur de B ne montre AUCUNE page d'Easy2Book (aucune fuite de nom de catégorie)", !/Easy2Book Seulement|CHEZ-EASY2BOOK|Omra|عمرة/.test(bobDestText.replace(/Omra — \/omra|Accueil|Voyages organisés|Promos hôtels/g, "")), bobDestText)
console.log(`   destinations proposées à B : ${bobDest.map((d) => d.split(" — ").pop()).join("  ")}`)
const bobProposesC = bobDest.some((d) => d.includes("/c/bob-ete"))
const bobProposesFixed = bobDest.some((d) => /— \/omra$/.test(d) || /— \/voyages-organises$/.test(d))

// ================================================================ 2. ce que sert réellement le site public pour B
let r = await head("/c/bob-ete")
const bobPageServed = r.status === 200
finding("la page /c/bob-ete (catégorie de B, proposée par son générateur) n'est PAS servie publiquement : le site renvoie le visiteur vers une page d'Easy2Book", !bobPageServed && bobProposesC,
  `générateur de B ${bobProposesC ? "propose" : "ne propose pas"} /c/bob-ete ; site public : HTTP ${r.status}${r.headers.get("location") ? ` → ${r.headers.get("location")} (page d'Easy2Book)` : ""}`)
finding("le générateur de B propose des pages FIXES d'Easy2Book (/omra, /voyages-organises, /summer-vibes, /)", bobProposesFixed, bobProposesFixed ? "ces pages mènent au site et au CRM d'Easy2Book, pas à B" : "")

// ================================================================ 3. collision d'adresse
r = await fetch(`${BASE}/c/collision-x`)
const colHtml = await r.text()
check("collision /c/collision-x : le site public sert la page d'EASY2BOOK, JAMAIS le contenu de B", r.status === 200 && colHtml.includes("CHEZ-EASY2BOOK") && !colHtml.includes("CHEZ-BOB"))
finding("collision d'adresse : B (qui a créé « collision-x ») obtiendrait un lien vers la page d'Easy2Book", bobDest.some((d) => d.includes("/c/collision-x")), "le lien de B envoie son trafic vers la page d'Easy2Book")

// ================================================================ 4. isolation des prospects + conservation des UTM
const e2bBefore = db.landing_leads.filter((l) => l.organization_id === E2B).length
const bobBefore = db.landing_leads.filter((l) => l.organization_id === BOB_ORG).length

async function submitOn(url, formSel, name, phone) {
  const ctx = await newCtx()
  const page = await ctx.newPage()
  page.on("pageerror", (e) => errors.push(e.message))
  await page.route("https://wa.me/**", (rt) => rt.fulfill({ body: "wa" }))
  await page.goto(url, { waitUntil: "networkidle" })
  const refuse = page.getByRole("button", { name: "Refuser" })
  if (await refuse.count()) await refuse.first().click()
  const form = page.locator(formSel)
  await form.locator("input[name=name]").fill(name)
  await form.locator("input[name=phone]").fill(phone)
  await form.locator("input[name=consent]").check()
  await form.locator("button[type=submit], button:not([type])").last().click()
  await page.waitForTimeout(1500)
  await ctx.close()
}

// 4a. page de la PLATEFORME avec campagne
await submitOn(`${BASE}/c/collision-x?utm_source=facebook&utm_medium=paid&utm_campaign=camp-plateforme&utm_content=visuel1`, "#category-collision-x", "Prospect Plateforme", "97 100 001")
const e2bNew = db.landing_leads.filter((l) => l.organization_id === E2B).slice(e2bBefore)
const bobNew1 = db.landing_leads.filter((l) => l.organization_id === BOB_ORG).slice(bobBefore)
const l1 = e2bNew.find((l) => l.first_name === "Prospect" || String(l.phone).endsWith("100001") || String(l.phone).includes("97100001"))
check("prospect arrivé par /c/… : enregistré chez Easy2Book, et chez PERSONNE d'autre", e2bNew.length === 1 && bobNew1.length === 0, `E2B +${e2bNew.length}, Bob +${bobNew1.length}`)
check("UTM conservées jusqu'au prospect (page de la plateforme) : campagne, source, contenu, canal, page d'arrivée", l1?.utm_campaign === "camp-plateforme" && l1?.utm_source === "facebook" && l1?.utm_content === "visuel1" && l1?.channel === "meta" && l1?.landing_page === "/c/collision-x", JSON.stringify({ c: l1?.utm_campaign, s: l1?.utm_source, ct: l1?.utm_content, ch: l1?.channel, lp: l1?.landing_page }))

// 4b. page de l'ENTREPRISE B (/o/…) avec campagne
const bobBefore2 = db.landing_leads.filter((l) => l.organization_id === BOB_ORG).length
const e2bBefore2 = db.landing_leads.filter((l) => l.organization_id === E2B).length
await submitOn(`${BASE}/o/bob-sarl?utm_source=facebook&utm_medium=paid&utm_campaign=camp-bob&utm_content=visuel2`, "form", "Prospect Bob", "97 200 002")
const bobNew2 = db.landing_leads.filter((l) => l.organization_id === BOB_ORG).slice(bobBefore2)
const e2bNew2 = db.landing_leads.filter((l) => l.organization_id === E2B).slice(e2bBefore2)
const l2 = bobNew2[0]
check("prospect arrivé par /o/bob-sarl : enregistré chez Bob SARL, JAMAIS chez Easy2Book", bobNew2.length === 1 && e2bNew2.length === 0, `Bob +${bobNew2.length}, E2B +${e2bNew2.length}`)
console.log(`   prospect de B : campagne=${l2?.utm_campaign ?? "∅"} source=${l2?.utm_source ?? "∅"} canal=${l2?.channel ?? "∅"} page d'arrivée=${l2?.landing_page ?? "∅"} page du formulaire=${l2?.form_page ?? "∅"}`)
finding("les paramètres de campagne d'un lien /o/… sont PERDUS avant d'arriver au prospect de B", !(l2?.utm_campaign === "camp-bob" && l2?.utm_source === "facebook"), `campagne enregistrée : ${l2?.utm_campaign ?? "aucune"}, source : ${l2?.utm_source ?? "aucune"}`)

// ================================================================ 5. l'administrateur d'Easy2Book ne voit pas les pages de B
const A = await login(ADMIN.email, ADMIN.password)
const e2bDest = (await destinations(A.page)).join(" | ")
check("le générateur d'Easy2Book ne montre aucune page de B", !/Circuit Bob|CHEZ-BOB|bob-ete/.test(e2bDest), e2bDest)
check("aucune erreur JavaScript", errors.length === 0, errors.join(" | "))

await browser.close()
await fake.close?.()
console.log("\n================ SYNTHÈSE DES DÉFAUTS CONSTATÉS (à décider, aucun n'est corrigé ici) ================")
if (!defects.length) console.log("aucun")
defects.forEach((d, i) => console.log(`${i + 1}. ${d}`))
console.log(failed ? `\n${failed} GARANTIE(S) EN ÉCHEC` : `\ngaranties de sécurité OK ; ${defects.length} défaut(s) constaté(s)`)
process.exit(failed ? 1 : 0)
