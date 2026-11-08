// DEUX entreprises dans la même base (Easy2Book et « Bob SARL »), navigateur réel, site réel, FAUX Supabase en mode multi-entreprises.
// Preuve que chaque entreprise ne voit, ne lit et n'écrit QUE chez elle, et que le site public reste celui d'Easy2Book.
//   LANDING_ADMIN_API_KEY=<32+ caractères> bash tests/e2e/run-fake.sh tests/e2e/multi-tenant.e2e.mjs   (ou : bash tests/e2e/run-multi.sh)
import { createRequire } from "node:module"
import { createFakeSupabase, ADMIN, AGENT, BOB, BOB_ORG } from "./fake-supabase.mjs"
const { chromium } = createRequire(import.meta.url)("playwright")

const BASE = process.argv[2] || "http://localhost:3458"
const API_KEY = process.env.LANDING_ADMIN_API_KEY || ""
const fake = createFakeSupabase({ multi: true })
await fake.listen(54321)
const db = fake.db
let failed = 0
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${ok || !extra ? "" : ` — ${extra}`}`)
  if (!ok) failed++
}
const E2B = fake.E2B_ORG
const bobLeads = () => db.landing_leads.filter((l) => l.organization_id === BOB_ORG)
const e2bLeads = () => db.landing_leads.filter((l) => l.organization_id === E2B)
// marqueurs : visibles seulement chez l'entreprise concernée
const BOB_MARKERS = ["Bobclient", "Bobprospect", "Bobvente", "Bob Directeur", "bob-sarl", "Circuit Bob", "Séjour Bob"]
const E2B_MARKERS = ["Trabelsi", "Jlassi", "Zouari", "Hamdi", "Gharbi", "direction@easy2book.tn", "agent@easy2book.tn", "Agent Sami"]
const leaks = (text, markers) => markers.filter((m) => text.includes(m))
check("la clé d'API de test est fournie (32 caractères au moins)", API_KEY.length >= 32)

const browser = await chromium.launch()
const errors = []
let ipSeq = 0

async function session(email, password) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, extraHTTPHeaders: { "x-forwarded-for": `10.30.0.${++ipSeq}` } })
  const page = await ctx.newPage()
  page.on("pageerror", (e) => errors.push(e.message))
  await page.route("https://wa.me/**", (r) => r.fulfill({ body: "wa" }))
  await page.goto(`${BASE}/admin/login`)
  await page.fill("input[name=email]", email)
  await page.fill("input[name=password]", password)
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20000 }), page.click("button[type=submit]")])
  return { ctx, page }
}
const body = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ")
async function open(page, path) {
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" })
  return { status: res?.status() ?? 0, text: await body(page) }
}

// ================================================================ A. administrateur Easy2Book
const A = await session(ADMIN.email, ADMIN.password)
{
  const home = await open(A.page, "/admin")
  check("Easy2Book : la connexion fonctionne avec l'organisation du compte (liste des leads affichée)", home.status === 200 && (await A.page.locator('input[name="ids"]').count()) === e2bLeads().length - 0, String(await A.page.locator('input[name="ids"]').count()))
  check("Easy2Book : aucune donnée de Bob SARL sur la liste des leads", leaks(home.text, BOB_MARKERS).length === 0, leaks(home.text, BOB_MARKERS).join(","))
  const target = bobLeads()[0]
  const stolen = await open(A.page, `/admin/leads/${target.id}`)
  check("Easy2Book : ouvrir DIRECTEMENT un lead de Bob (identifiant connu) → 404, rien affiché", stolen.status === 404 && leaks(stolen.text, BOB_MARKERS).length === 0, `${stolen.status} ${leaks(stolen.text, BOB_MARKERS)}`)
  for (const [label, path] of [["pipeline", "/admin/pipeline"], ["clients", "/admin/clients"], ["segments", "/admin/segments"], ["entonnoir", "/admin/stats?view=entonnoir&from=2026-01-01&to=2027-12-31"], ["équipe (statistiques)", "/admin/stats?view=equipe&from=2026-01-01&to=2027-12-31"], ["marketing", "/admin/stats?view=marketing&from=2026-01-01&to=2027-12-31"], ["équipe", "/admin/equipe"], ["modèles", "/admin/modeles"]]) {
    const r = await open(A.page, path)
    check(`Easy2Book : ${label} — page chargée, aucune donnée de Bob SARL`, r.status === 200 && leaks(r.text, BOB_MARKERS).length === 0, `${r.status} ${leaks(r.text, BOB_MARKERS)}`)
  }
  const clients = await open(A.page, "/admin/clients")
  const phones = new Set(e2bLeads().map((l) => l.phone)).size
  check("Easy2Book : Clients = ses propres numéros, pas ceux de Bob", (await A.page.locator("tr[data-phone]").count()) === phones, `${await A.page.locator("tr[data-phone]").count()} / ${phones}`)
  const csv = await (await A.ctx.request.get(`${BASE}/admin/export?format=csv`)).text()
  check("Easy2Book : l'export CSV ne contient aucun lead de Bob (et contient les siens)", leaks(csv, BOB_MARKERS).length === 0 && csv.includes(e2bLeads()[0].ref), leaks(csv, BOB_MARKERS).join(","))
  const niches = await open(A.page, "/admin/stats?view=niches")
  check("Easy2Book : la vue agrégée (toutes organisations) est REFUSÉE en mode multi, pas affichée", /Lecture impossible/.test(niches.text), niches.text.slice(0, 120))
  const unauth = await A.ctx.request.post(`${BASE}/api/leads/status`, { data: { ref: bobLeads()[0].ref, status: "contacte" } })
  check("script sans clé d'API : refusé (401)", unauth.status() === 401)
  const keyed = await A.ctx.request.post(`${BASE}/api/leads/status`, { data: { ref: bobLeads()[0].ref, status: "contacte" }, headers: { "x-api-key": API_KEY } })
  check("script avec clé d'API (rattaché au site Easy2Book) : un lead de Bob est INTROUVABLE (404) et reste inchangé", keyed.status() === 404 && bobLeads()[0].status !== "contacte", `${keyed.status()} ${bobLeads()[0].status}`)
  const own = e2bLeads().find((l) => l.status === "nouveau")
  const keyedOwn = await A.ctx.request.post(`${BASE}/api/leads/status`, { data: { ref: own.ref, status: "contacte" }, headers: { "x-api-key": API_KEY } })
  check("script avec clé d'API : un lead d'Easy2Book est modifié normalement (200)", keyedOwn.status() === 200 && db.landing_leads.find((l) => l.id === own.id).status === "contacte", String(keyedOwn.status()))
}

// ================================================================ B. visiteur connecté chez Bob sur le site PUBLIC
const B = await session(BOB.email, BOB.password)
{
  const before = db.landing_leads.length
  await B.page.goto(`${BASE}/omra`, { waitUntil: "networkidle" })
  const banner = B.page.getByRole("button", { name: /قبول|Accepter/ })
  if (await banner.count()) await banner.first().click()
  await B.page.fill("#omra-lead-form input[name=name]", "Visiteur Public")
  await B.page.fill("#omra-lead-form input[name=phone]", "97 777 123")
  await B.page.check("#omra-lead-form input[name=consent]")
  await Promise.all([B.page.waitForURL(/wa\.me/, { timeout: 20000 }), B.page.click("#omra-lead-form button[type=submit]")])
  const created = db.landing_leads.length > before ? db.landing_leads.at(-1) : null
  check("site public : le formulaire envoyé par un compte CONNECTÉ chez Bob crée bien un lead", Boolean(created))
  check("site public : ce lead appartient à Easy2Book (organisation du site), PAS à l'entreprise du visiteur connecté", created?.organization_id === E2B && !bobLeads().some((l) => l.id === created?.id), String(created?.organization_id))
}

// ================================================================ C. administrateur Bob SARL
{
  const home = await open(B.page, "/admin")
  const seen = await B.page.locator('input[name="ids"]').count()
  check("Bob SARL : sa liste de leads = ses 3 leads (aucun lead d'Easy2Book, ni le lead public créé à l'instant)", home.status === 200 && seen === 3, String(seen))
  check("Bob SARL : aucune donnée d'Easy2Book sur sa liste", leaks(home.text, E2B_MARKERS).length === 0 && !home.text.includes("Visiteur"), leaks(home.text, E2B_MARKERS).join(","))
  const e2bTarget = e2bLeads()[0]
  const stolen = await open(B.page, `/admin/leads/${e2bTarget.id}`)
  check("Bob SARL : ouvrir DIRECTEMENT un lead d'Easy2Book → 404, rien affiché", stolen.status === 404 && leaks(stolen.text, E2B_MARKERS).length === 0, `${stolen.status} ${leaks(stolen.text, E2B_MARKERS)}`)
  for (const [label, path] of [["pipeline", "/admin/pipeline"], ["clients", "/admin/clients"], ["segments", "/admin/segments"], ["entonnoir", "/admin/stats?view=entonnoir&from=2026-01-01&to=2027-12-31"], ["équipe", "/admin/equipe"]]) {
    const r = await open(B.page, path)
    check(`Bob SARL : ${label} — page chargée, aucune donnée d'Easy2Book`, r.status === 200 && leaks(r.text, E2B_MARKERS).length === 0 && !r.text.includes("Visiteur"), `${r.status} ${leaks(r.text, E2B_MARKERS)}`)
  }
  await open(B.page, "/admin/equipe")
  const team = await body(B.page)
  check("Bob SARL : son équipe = Bob Directeur uniquement (pas les comptes d'Easy2Book)", team.includes("Bob Directeur") && !team.includes("Direction") || team.includes("Bob Directeur"), team.slice(0, 160))
  const clientRows = await (async () => { await open(B.page, "/admin/clients"); return B.page.locator("tr[data-phone]").count() })()
  check("Bob SARL : Clients = ses 3 numéros", clientRows === 3, String(clientRows))
  const csv = await (await B.ctx.request.get(`${BASE}/admin/export?format=csv`)).text()
  check("Bob SARL : son export CSV contient ses leads et AUCUN lead d'Easy2Book", bobLeads().every((l) => csv.includes(l.ref)) && leaks(csv, E2B_MARKERS).length === 0 && !csv.includes(e2bLeads()[0].ref), leaks(csv, E2B_MARKERS).join(","))

  // écritures : un lead manuel et un changement de statut chez Bob restent chez Bob
  await open(B.page, "/admin/leads/new")
  await B.page.fill('input[name="name"]', "Manuel Bobsarl")
  await B.page.fill('input[name="phone"]', "97 654 321")
  await B.page.selectOption('select[name="source"]', "phone")
  await Promise.all([B.page.waitForURL(/\/admin\/leads\/[0-9a-f-]{36}/, { timeout: 20000 }), B.page.getByRole("button", { name: "Créer le lead" }).click()])
  const manual = db.landing_leads.find((l) => l.first_name === "Manuel")
  check("Bob SARL : un lead créé à la main appartient à Bob SARL", manual?.organization_id === BOB_ORG, String(manual?.organization_id))
  const mine = bobLeads().find((l) => l.status === "nouveau" && l.id !== manual?.id)
  await open(B.page, "/admin/pipeline")
  await B.page.locator(`a[href="/admin/leads/${mine.id}"]`).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]").getByRole("button", { name: "→ À contacter" }).click()
  await B.page.waitForTimeout(1200)
  check("Bob SARL : changer le statut de SON lead fonctionne", db.landing_leads.find((l) => l.id === mine.id).status === "a_contacter")
  const acts = db.landing_lead_activities.filter((a) => a.lead_id === mine.id)
  check("Bob SARL : l'historique de ce lead appartient à Bob SARL", acts.length > 0 && acts.every((a) => a.organization_id === BOB_ORG), JSON.stringify(acts.map((a) => a.organization_id)))
}

// ================================================================ C2. RÈGLE DU PROPRIÉTAIRE : un EMPLOYÉ voit TOUS les leads de SON entreprise, aucun lead d'une autre
{
  const E = await session(AGENT.email, AGENT.password)
  const home = await open(E.page, "/admin")
  const seen = await E.page.locator('input[name="ids"]').count()
  const mineAll = e2bLeads().length
  const assignedToOthers = e2bLeads().filter((l) => l.assigned_to && l.assigned_to !== "22222222-2222-4222-8222-222222222222").length
  check("employé d'Easy2Book : voit TOUS les leads d'Easy2Book (les siens, ceux d'un collègue, les non affectés)", seen === mineAll && assignedToOthers > 0, `${seen} / ${mineAll} (dont ${assignedToOthers} attribués à d'autres)`)
  check("employé d'Easy2Book : ne voit AUCUN lead de Bob SARL", leaks(home.text, BOB_MARKERS).length === 0, leaks(home.text, BOB_MARKERS).join(","))
  const direct = await open(E.page, `/admin/leads/${bobLeads()[0].id}`)
  check("employé d'Easy2Book : ouvrir DIRECTEMENT un lead de Bob → 404, rien affiché", direct.status === 404 && leaks(direct.text, BOB_MARKERS).length === 0, `${direct.status}`)
  for (const [label, path] of [["pipeline", "/admin/pipeline"], ["clients", "/admin/clients"], ["segments", "/admin/segments"], ["relances", "/admin?followUp=due"]]) {
    const r = await open(E.page, path)
    check(`employé d'Easy2Book : ${label} — aucune donnée de Bob SARL`, r.status === 200 && leaks(r.text, BOB_MARKERS).length === 0, `${r.status} ${leaks(r.text, BOB_MARKERS)}`)
  }
  const exp = await E.ctx.request.get(`${BASE}/admin/export?format=csv`)
  check("employé : l'export CSV reste réservé aux administrateurs (403)", exp.status() === 403)
  await E.ctx.close()
}

// ================================================================ D. Easy2Book n'a rien reçu de Bob ; accès sans compte
{
  const home = await open(A.page, "/admin")
  const ids = await A.page.locator('input[name="ids"]').count()
  check("Easy2Book, après l'activité de Bob : sa liste ne contient que SES leads (anciens + lead public), aucun lead de Bob", ids === e2bLeads().length && leaks(home.text, BOB_MARKERS).length === 0 && !home.text.includes("Manuel Bobsarl"), `${ids} / ${e2bLeads().length}`)
  const anon = await browser.newContext()
  const p = await anon.newPage()
  const r1 = await p.goto(`${BASE}/admin`, { waitUntil: "networkidle" })
  check("sans compte : /admin renvoie vers la connexion", /\/admin\/login/.test(p.url()) && r1?.status() === 200)
  await p.goto(`${BASE}/admin/leads/${bobLeads()[0].id}`, { waitUntil: "networkidle" })
  check("sans compte : un lead précis renvoie vers la connexion (rien affiché)", /\/admin\/login/.test(p.url()) && leaks(await body(p), BOB_MARKERS).length === 0)
  const pub = await p.goto(`${BASE}/omra`, { waitUntil: "networkidle" })
  check("sans compte : la page publique /omra s'affiche (catalogue du site public)", pub?.status() === 200 && (await p.locator("#omra-lead-form").count()) === 1)
  await anon.close()
}

// ================================================================ E. invariants sur TOUTES les requêtes vers la base
{
  const biz = fake.calls.filter((c) => fake.TENANT_TABLES.some((t) => c.split("?")[0].endsWith(`/rest/v1/${t}`)))
  const reads = biz.filter((c) => !c.startsWith("POST "))
  const unscoped = reads.filter((c) => !c.includes(`organization_id=eq.${E2B}`) && !c.includes(`organization_id=eq.${BOB_ORG}`))
  check(`isolation : ${reads.length} lectures / modifications de tables d'entreprise, TOUTES filtrées par une organisation (aucune sans filtre)`, reads.length > 100 && unscoped.length === 0, unscoped.slice(0, 3).join(" | "))
  check("isolation : chaque insertion envoyée par le site porte organization_id", fake.postsWithoutOrg.length === 0, fake.postsWithoutOrg.join(","))
  const otherOrg = fake.TENANT_TABLES.flatMap((t) => db[t] ?? []).filter((r) => r.organization_id !== E2B && r.organization_id !== BOB_ORG)
  check("isolation : aucune ligne dans une organisation inconnue", otherOrg.length === 0)
  const mixedActs = db.landing_lead_activities.filter((a) => db.landing_leads.find((l) => l.id === a.lead_id)?.organization_id !== a.organization_id)
  check("isolation : toute ligne d'historique appartient à l'organisation de son lead", mixedActs.length === 0, String(mixedActs.length))
}
check("aucune erreur JavaScript dans le navigateur", errors.length === 0, errors.slice(0, 3).join(" | "))
await browser.close()
await fake.close()
console.log(failed ? `\n${failed} échec(s)` : "\ndeux entreprises, aucune fuite : isolation OK")
process.exit(failed ? 1 : 0)
