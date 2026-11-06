// Réseaux sociaux → landing page → formulaire → lead CRM, de bout en bout (navigateur réel, site réel, FAUX Supabase).
// Preuve de la conservation des paramètres UTM jusqu'à l'enregistrement du lead, et du respect du consentement.
// Aucune publicité, aucun envoi à Meta / TikTok / WhatsApp (jetons absents, wa.me intercepté).
//   bash tests/e2e/run-fake.sh tests/e2e/social.e2e.mjs
import { createRequire } from "node:module"
import { createFakeSupabase, ADMIN } from "./fake-supabase.mjs"
const { chromium } = createRequire(import.meta.url)("playwright")

const BASE = process.argv[2] || "http://localhost:3458"
const fake = createFakeSupabase()
await fake.listen(54321)
const leads = fake.db.landing_leads
let failed = 0
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${ok || !extra ? "" : ` — ${extra}`}`)
  if (!ok) failed++
}
let phoneSeq = 0
let ipSeq = 0 // chaque visiteur simulé a sa propre adresse : la protection « 5 demandes / 10 min / IP » reste active
const phone = () => `9${String(1000000 + ++phoneSeq * 7919).slice(-7)}`

const browser = await chromium.launch()
const errors = []

/** Une visite complète : ouvre `url`, (consent), éventuellement navigue, remplit et envoie le formulaire de /omra. */
async function visit({ url, consent, userAgent, navigateTo, viewport = { width: 390, height: 844 }, formId = "#omra-lead-form" }) {
  const ctx = await browser.newContext({ viewport, userAgent, extraHTTPHeaders: { "x-forwarded-for": `10.20.0.${++ipSeq}` } })
  const page = await ctx.newPage()
  page.on("pageerror", (e) => errors.push(e.message))
  await page.route("https://wa.me/**", (r) => r.fulfill({ body: "wa" })) // aucun contact WhatsApp réel
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" })
  const banner = page.getByRole("button", { name: consent ? /قبول|Accepter/ : /رفض|Refuser/ })
  if (await banner.count()) await banner.first().click()
  await page.waitForTimeout(400)
  if (navigateTo) {
    await Promise.all([page.waitForURL((u) => u.pathname === navigateTo, { timeout: 10000 }), page.locator(`a[href="${navigateTo}"]`).first().click()])
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(300)
  }
  const before = leads.length
  await page.fill(`${formId} input[name=name]`, "Test Social")
  await page.fill(`${formId} input[name=phone]`, phone())
  await page.check(`${formId} input[name=consent]`)
  await Promise.all([page.waitForURL(/wa\.me/, { timeout: 15000 }), page.click(`${formId} button[type=submit]`)])
  const lead = leads.length > before ? leads.at(-1) : null
  await ctx.close()
  return lead
}

// ---------------------------------------------------------------- 1. lien de bio Instagram → accueil → Omra → lead
{
  const lead = await visit({ url: "/?utm_source=instagram&utm_medium=bio&utm_campaign=bio", consent: true, navigateTo: "/omra" })
  check("Instagram (bio) : lead enregistré", Boolean(lead))
  check("Instagram (bio) : canal meta, source instagram, support bio, campagne bio", lead?.channel === "meta" && lead?.utm_source === "instagram" && lead?.utm_medium === "bio" && lead?.utm_campaign === "bio", JSON.stringify(lead && { c: lead.channel, s: lead.utm_source, m: lead.utm_medium }))
  check("Instagram (bio) : page d'arrivée « / » conservée, page du formulaire « /omra »", lead?.landing_page === "/" && lead?.form_page === "/omra", `${lead?.landing_page} → ${lead?.form_page}`)
  check("Instagram (bio) : le paramètre survit à la navigation interne (accueil → Omra)", lead?.utm_source === "instagram")
}

// ---------------------------------------------------------------- 2. Facebook payant avec clic publicitaire, consentement ACCEPTÉ
{
  const lead = await visit({ url: "/omra?utm_source=facebook&utm_medium=paid&utm_campaign=omra-ramadan-2027&utm_content=video-groupe&utm_term=femmes-35-55&campaign_id=111&adset_id=222&ad_id=333&fbclid=FBCLID_TEST", consent: true })
  check("Facebook payant : canal meta + campagne, groupe, annonce (noms et identifiants)", lead?.channel === "meta" && lead?.utm_campaign === "omra-ramadan-2027" && lead?.utm_term === "femmes-35-55" && lead?.utm_content === "video-groupe" && lead?.campaign_id === "111" && lead?.adset_id === "222" && lead?.ad_id === "333")
  check("Facebook payant : offre / page rattachées (arrivée et formulaire = /omra, produit omra)", lead?.landing_page === "/omra" && lead?.form_page === "/omra" && lead?.product === "omra")
  check("Facebook payant (consentement accepté) : fbclid et identifiant visiteur enregistrés", lead?.fbclid === "FBCLID_TEST" && Boolean(lead?.visitor_id) && lead?.tracking_consent === true)
}

// ---------------------------------------------------------------- 3. même visite, consentement REFUSÉ
{
  const lead = await visit({ url: "/omra?utm_source=facebook&utm_medium=paid&utm_campaign=omra-ramadan-2027&fbclid=FBCLID_REFUS", consent: false })
  check("Consentement refusé : la campagne est quand même rattachée au lead (donnée non personnelle)", lead?.channel === "meta" && lead?.utm_campaign === "omra-ramadan-2027")
  check("Consentement refusé : AUCUN fbclid, identifiant visiteur, IP ni navigateur enregistrés", lead?.tracking_consent === false && !lead?.fbclid && !lead?.visitor_id && !lead?.ip && !lead?.user_agent && !lead?.fbp && !lead?.fbc)
}

// ---------------------------------------------------------------- 4. TikTok payant avec paramètres dynamiques remplis par la plateforme
{
  const lead = await visit({ url: "/omra?utm_source=tiktok&utm_medium=paid&utm_campaign=Omra%20Ramadan&utm_term=Femmes%2035-55&utm_content=Video%201&campaign_id=1234&adset_id=5678&ad_id=9012&ttclid=TTCLID_TEST", consent: true })
  check("TikTok payant (paramètres dynamiques) : canal tiktok, noms et identifiants conservés", lead?.channel === "tiktok" && lead?.utm_campaign === "Omra Ramadan" && lead?.utm_term === "Femmes 35-55" && lead?.utm_content === "Video 1" && lead?.campaign_id === "1234" && lead?.adset_id === "5678" && lead?.ad_id === "9012")
  check("TikTok payant : ttclid enregistré avec consentement", lead?.ttclid === "TTCLID_TEST")
}

// ---------------------------------------------------------------- 5. WhatsApp (diffusion), 6. direct, 7. navigateur intégré, 8. faux ami
{
  const wa = await visit({ url: "/omra?utm_source=whatsapp&utm_medium=message&utm_campaign=diffusion-janvier", consent: true })
  check("WhatsApp (diffusion) : canal whatsapp", wa?.channel === "whatsapp" && wa?.utm_medium === "message")
  const direct = await visit({ url: "/omra", consent: true })
  check("Visite directe sans paramètre : canal direct, aucune campagne inventée", direct?.channel === "direct" && !direct?.utm_campaign && !direct?.utm_source)
  const inapp = await visit({ url: "/omra", consent: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile Instagram 300.0.0.0" })
  check("Navigateur intégré d'Instagram sans paramètre : canal meta, sans UTM inventées", inapp?.channel === "meta" && !inapp?.utm_source && !inapp?.utm_campaign)
  const fake1 = await visit({ url: "/omra?utm_source=digital_bio&utm_campaign=x", consent: true })
  check("« digital_bio » n'est PAS classé Meta (régression corrigée)", fake1?.channel === "referral" && fake1?.utm_source === "digital_bio")
}

// ---------------------------------------------------------------- 9. adresse en double : /c/omra-2027 → /omra avec paramètres
{
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/c/omra-2027?utm_source=tiktok&utm_medium=bio&utm_campaign=bio`, { waitUntil: "networkidle" })
  const u = new URL(page.url())
  check("/c/omra-2027 redirige vers /omra en conservant les paramètres", u.pathname === "/omra" && u.searchParams.get("utm_source") === "tiktok" && u.searchParams.get("utm_campaign") === "bio", page.url())
  await ctx.close()
}

// ---------------------------------------------------------------- 10. chaîne complète : générateur de liens → clic → formulaire → fiche CRM
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } })
  const page = await ctx.newPage()
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(`${BASE}/admin/login`)
  await page.fill("input[name=email]", ADMIN.email)
  await page.fill("input[name=password]", ADMIN.password)
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/login")), page.click("button[type=submit]")])
  await page.goto(`${BASE}/admin/liens`, { waitUntil: "networkidle" })
  check("générateur : la page affiche les liens de bio des 3 comptes officiels", (await page.getByText("utm_source=instagram&utm_medium=bio&utm_campaign=bio").count()) >= 1 && (await page.getByText("utm_source=tiktok&utm_medium=bio").count()) >= 1 && (await page.getByText("utm_source=facebook&utm_medium=organic_social").count()) >= 1)
  await page.getByLabel("Réseau", { exact: true }).selectOption("tiktok")
  await page.getByLabel("Support", { exact: true }).selectOption("organic")
  await page.getByLabel("Page de destination").selectOption("/omra")
  await page.getByLabel("Nom de la campagne").fill("Omra Ramadan 2027")
  await page.getByLabel("Contenu").fill("Vidéo Groupe")
  const generated = (await page.getByTestId("generated-link").innerText()).trim()
  check("générateur : lien normalisé (sans accent ni espace)", /\/omra\?utm_source=tiktok&utm_medium=organic_social&utm_campaign=omra-ramadan-2027&utm_content=video-groupe$/.test(generated), generated)
  await page.getByLabel("Page de destination").selectOption("/omra")
  await page.getByLabel("Nom de la campagne").fill("")
  check("générateur : campagne vide refusée avec un message clair", await page.getByRole("status").getByText(/Nom de campagne requis/).isVisible())
  await page.getByLabel("Réseau", { exact: true }).selectOption("facebook")
  await page.getByLabel("Support", { exact: true }).selectOption("paid")
  await page.getByLabel("Paramètres dynamiques").check()
  check("générateur : paramètres dynamiques Meta fournis tels quels", (await page.getByTestId("generated-link").innerText()).includes("utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}"))
  await ctx.close()

  // le lien généré (hôte local) est suivi comme le ferait un visiteur
  const local = generated.replace(/^https?:\/\/[^/]+/, BASE)
  const lead = await visit({ url: local.slice(BASE.length), consent: true })
  check("chaîne complète : lien généré → clic → formulaire → lead avec la source, le support, la campagne et le visuel", lead?.channel === "tiktok" && lead?.utm_source === "tiktok" && lead?.utm_medium === "organic_social" && lead?.utm_campaign === "omra-ramadan-2027" && lead?.utm_content === "video-groupe")

  // le lead est visible dans le CRM avec sa source (fiche et statistiques)
  const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 860 } })
  const p2 = await ctx2.newPage()
  await p2.goto(`${BASE}/admin/login`)
  await p2.fill("input[name=email]", ADMIN.email)
  await p2.fill("input[name=password]", ADMIN.password)
  await Promise.all([p2.waitForURL((u) => !u.pathname.endsWith("/login")), p2.click("button[type=submit]")])
  await p2.goto(`${BASE}/admin/leads/${lead.id}`, { waitUntil: "networkidle" })
  const main = await p2.locator("main").innerText()
  check("fiche CRM : source « tiktok · organic_social », page d'arrivée et page du formulaire affichées", main.includes("tiktok · organic_social") && main.includes("Page d'arrivée") && main.includes("Page du formulaire"))
  await p2.goto(`${BASE}/admin/stats?level=campaign`, { waitUntil: "networkidle" })
  const stats = await p2.locator("main").innerText()
  check("statistiques : colonne « Source » (Facebook et Instagram distingués dans le canal meta)", stats.includes("Source") && stats.includes("instagram · bio") && stats.includes("facebook · paid"))
  await ctx2.close()
}

check("aucune erreur JavaScript dans le navigateur", errors.length === 0, errors.slice(0, 3).join(" | "))
// Un test navigateur ne voit pas les appels sortants du serveur : on garantit l'absence d'envoi par l'absence de jetons
// (run-fake.sh les retire de l'environnement, aucune intégration enregistrée). L'envoi conditionné au consentement
// est couvert par tests/track-route.test.ts, tests/leads-route.test.ts et tests/meta-tiktok.test.ts.
check("aucun jeton Meta / TikTok configuré dans ce test (aucun envoi publicitaire possible)", fake.db.landing_integrations.length === 0 && !process.env.META_ACCESS_TOKEN && !process.env.TIKTOK_ACCESS_TOKEN)
await browser.close()
await fake.close()
console.log(failed ? `\n${failed} échec(s)` : "\nréseaux → landing → lead OK")
process.exit(failed ? 1 : 0)
