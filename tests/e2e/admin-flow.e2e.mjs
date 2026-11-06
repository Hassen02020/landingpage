// Parcours fonctionnel de l'espace /admin : connexion, droits, menu, actions réelles (formulaires, actions
// serveur) contre un FAUX Supabase en mémoire. Rien n'est écrit dans la vraie base.
//   LANDING_SUPABASE_URL=http://127.0.0.1:54321 LANDING_SUPABASE_SERVICE_ROLE_KEY=test-service-role-key-0123456789 \
//   LANDING_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test npm start -- -p 3458 &
//   node tests/e2e/admin-flow.e2e.mjs http://localhost:3458
import { createRequire } from "node:module"
import { createFakeSupabase, ADMIN, AGENT } from "./fake-supabase.mjs"
const { chromium } = createRequire(import.meta.url)("playwright")

const BASE = process.argv[2] || "http://localhost:3458"
const fake = createFakeSupabase()
await fake.listen(54321)
const db = fake.db
let failed = 0
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${ok || !extra ? "" : ` — ${extra}`}`)
  if (!ok) failed++
}
const LEAD = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")

const browser = await chromium.launch()
const errors = []
async function session(creds, viewport = { width: 1366, height: 860 }) {
  const ctx = await browser.newContext({ viewport, locale: "fr-FR" })
  const page = await ctx.newPage()
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(`${BASE}/admin/login`)
  await page.fill("input[name=email]", creds.email)
  await page.fill("input[name=password]", creds.password)
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 15000 }), page.click("button[type=submit]")])
  return { ctx, page }
}
const settle = (page) => page.waitForLoadState("networkidle")

// ---------------------------------------------------------------- connexion
{
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const anon = await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" })
  check("sans connexion : /admin renvoie vers la page de connexion", page.url().includes("/admin/login"), page.url())
  await page.fill("input[name=email]", ADMIN.email)
  await page.fill("input[name=password]", "mauvais-mot-de-passe")
  await page.click("button[type=submit]")
  await page.getByText("Identifiants invalides").waitFor({ timeout: 8000 }).catch(() => {})
  check("mauvais mot de passe : message d'erreur, pas d'accès", await page.getByText("Identifiants invalides").isVisible())
  void anon
  await ctx.close()
}

// ---------------------------------------------------------------- administrateur
const { ctx, page } = await session(ADMIN)
check("connexion administrateur réussie", page.url().startsWith(`${BASE}/admin`) && !page.url().includes("login"), page.url())
const side = page.locator("aside")
for (const item of ["Leads", "Pipeline", "Relances", "Nouveau lead", "Statistiques", "Calculateur", "Offres et catégories", "Codes promo", "Intégrations", "Protection", "Équipe", "Modèles WhatsApp", "Export CSV"]) {
  if (!(await side.getByRole("link", { name: item, exact: true }).isVisible())) check(`menu : « ${item} » visible`, false)
}
check("menu groupé : les 4 groupes sont présents", (await side.getByText(/^(Leads|Analyse|Catalogue|Réglages)$/i).count()) >= 4)
check("menu : « Leads » est actif sur l'accueil", (await side.locator('a[aria-current="page"]').innerText()).trim() === "Leads")

await page.goto(`${BASE}/admin/pipeline`, { waitUntil: "networkidle" })
check("menu : « Pipeline » est actif sur /admin/pipeline", (await side.locator('a[aria-current="page"]').innerText()).trim() === "Pipeline")
await page.goto(`${BASE}/admin?followUp=due`, { waitUntil: "networkidle" })
check("menu : « Relances » est actif sur /admin?followUp=due", (await side.locator('a[aria-current="page"]').innerText()).trim() === "Relances")

// ---------------------------------------------------------------- accueil, filtres, action groupée
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" })
for (const c of ["À traiter", "Reçus aujourd'hui", "Relances échues", "Mes dossiers ouverts", "Non assignés"]) {
  if (!(await page.getByText(c, { exact: true }).first().isVisible())) check(`accueil : carte « ${c} »`, false)
}
check("accueil : 10 leads listés", (await page.locator('input[name="ids"]').count()) === 10)
await page.goto(`${BASE}/admin?status=perdu`, { waitUntil: "networkidle" })
check("filtre statut « perdu » : 1 lead", (await page.locator('input[name="ids"]').count()) === 1)

await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" })
await page.locator(`input[name="ids"][value="${LEAD(1)}"]`).check()
await page.locator(`input[name="ids"][value="${LEAD(2)}"]`).check()
await page.selectOption('select[name="bulk"]', "status:contacte")
await Promise.all([page.waitForURL(/ok=/), page.getByRole("button", { name: "Appliquer" }).click()])
await settle(page)
check("action groupée : message « 2 lead(s) mis à jour »", await page.getByText("2 lead(s) mis à jour").isVisible())
check("action groupée : statuts changés en base", db.landing_leads.find((l) => l.id === LEAD(1)).status === "contacte" && db.landing_leads.find((l) => l.id === LEAD(2)).status === "contacte")
check("action groupée : historique écrit pour chaque lead", db.landing_lead_activities.filter((a) => a.type === "status_change").length >= 2)

await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" })
await page.locator(`input[name="ids"][value="${LEAD(9)}"]`).check()
await page.selectOption('select[name="bulk"]', `assign:${db.landing_staff[1].user_id}`)
await Promise.all([page.waitForURL(/ok=/), page.getByRole("button", { name: "Appliquer" }).click()])
check("action groupée : assignation à un agent", db.landing_leads.find((l) => l.id === LEAD(9)).assigned_to === db.landing_staff[1].user_id)

// ---------------------------------------------------------------- pipeline
await page.goto(`${BASE}/admin/pipeline`, { waitUntil: "networkidle" })
const columns = await page.locator("[data-testid=pipeline-board] section").evaluateAll((els) => els.map((e) => e.getAttribute("data-status")))
check("pipeline : 10 colonnes dans l'ordre du pipeline commercial", JSON.stringify(columns) === JSON.stringify(["nouveau", "a_contacter", "contacte", "a_qualifier", "qualifie", "devis", "negociation", "reserve", "gagne", "perdu"]), columns.join(","))
await page.locator(`a[href="/admin/leads/${LEAD(7)}"]`).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]").getByRole("button", { name: "→ À contacter" }).click()
await page.waitForTimeout(1200)
check("pipeline : « → À contacter » déplace le lead d'une étape", db.landing_leads.find((l) => l.id === LEAD(7)).status === "a_contacter")

// ---------------------------------------------------------------- fiche lead
await page.goto(`${BASE}/admin/leads/${LEAD(1)}`, { waitUntil: "networkidle" })
check("fiche : modèles WhatsApp prêts affichés", (await page.getByRole("link", { name: /Premier contact/ }).count()) >= 1)
const wa = decodeURIComponent((await page.getByRole("link", { name: /Premier contact \(Omra\)/ }).getAttribute("href")) || "")
check("fiche : variables remplacées dans le message (prénom, réf, offre)", wa.includes("وصلنا طلبك (E2B-") && wa.includes("Ahmed") === false ? wa.includes("الفوج الثاني") : wa.includes("Ahmed"), wa.slice(0, 160))
check("fiche : doublon du même numéro signalé", await page.getByText("Même numéro").isVisible())
await page.getByPlaceholder("Ajouter une note").fill("Appel passé, rappeler demain")
await Promise.all([page.waitForURL(/ok=/), page.getByRole("button", { name: /Ajouter|Enregistrer/ }).last().click()])
check("fiche : note enregistrée dans l'historique", db.landing_lead_activities.some((a) => a.type === "note" && a.body.includes("rappeler demain")))
// qualification commerciale (région, e-mail, budget déclaré, voyageurs) — pendant le suivi, pas au premier contact
await page.selectOption('select[name="region"]', "Sousse")
await page.fill('input[name="email"]', "client@example.tn")
await page.fill('input[name="budget"]', "5000 TND / pers.")
await page.fill('input[name="adults"]', "2")
await page.getByRole("button", { name: "Enregistrer la qualification" }).click()
await page.getByText("Qualification enregistrée").waitFor({ timeout: 10000 }).catch(() => {})
const qualified = db.landing_leads.find((l) => l.id === LEAD(1))
check("qualification : région, e-mail, budget déclaré et voyageurs enregistrés", qualified.region === "Sousse" && qualified.email === "client@example.tn" && qualified.budget === "5000 TND / pers." && qualified.adults === 2)
check("qualification : tracée dans l'historique sans copier l'e-mail", db.landing_lead_activities.some((a) => a.type === "note" && a.body.startsWith("Qualification") && a.body.includes("Région : Sousse") && !a.body.includes("example.tn")))
await page.fill('input[name="email"]', "client@localhost") // accepté par le navigateur, refusé par nos règles (le serveur revérifie toujours)
await page.getByRole("button", { name: "Enregistrer la qualification" }).click()
await page.getByText("Adresse e-mail invalide").waitFor({ timeout: 10000 }).catch(() => {})
check("qualification : e-mail invalide refusé sans rien écraser", (await page.getByText("Adresse e-mail invalide").isVisible()) && db.landing_leads.find((l) => l.id === LEAD(1)).email === "client@example.tn")
await page.goto(`${BASE}/admin/leads/${LEAD(1)}`, { waitUntil: "networkidle" })
await page.selectOption('select[name="status"]', "reserve")
await page.fill('input[name="booking_value"]', "15600")
await page.locator("form").filter({ hasText: "Changer le statut" }).getByRole("button", { name: "Enregistrer" }).click()
await page.getByText(/Statut enregistré/).waitFor({ timeout: 10000 }).catch(() => {})
const booked = db.landing_leads.find((l) => l.id === LEAD(1))
check("fiche : réservation avec montant", booked.status === "reserve" && Number(booked.booking_value) === 15600 && Boolean(booked.booked_at))
await page.goto(`${BASE}/admin/leads/${LEAD(6)}`, { waitUntil: "networkidle" })
await page.selectOption('select[name="status"]', "reserve")
await page.locator("form").filter({ hasText: "Changer le statut" }).getByRole("button", { name: "Enregistrer" }).click()
await page.getByText("Montant de la réservation obligatoire").waitFor({ timeout: 8000 }).catch(() => {})
check("fiche : « réservé » sans montant refusé", await page.getByText("Montant de la réservation obligatoire").isVisible())

await page.goto(`${BASE}/admin/leads/${LEAD(7)}`, { waitUntil: "networkidle" })
await Promise.all([page.waitForURL(/ok=/), page.getByRole("button", { name: /Marquer cette fiche comme doublon/ }).first().click()])
check("fiche : « marquer comme doublon » → statut perdu + note", db.landing_leads.find((l) => l.id === LEAD(7)).status === "perdu" && db.landing_lead_activities.some((a) => a.body?.startsWith("Doublon de E2B-")))

// nouveau lead manuel
await page.goto(`${BASE}/admin/leads/new`, { waitUntil: "networkidle" })
await page.fill('input[name="name"]', "Test Manuel")
await page.fill('input[name="phone"]', "97 123 456")
await page.selectOption('select[name="source"]', "phone")
await Promise.all([page.waitForURL(/\/admin\/leads\/[0-9a-f-]{36}/), page.getByRole("button", { name: "Créer le lead" }).click()])
check("nouveau lead manuel créé (source téléphone)", db.landing_leads.some((l) => l.first_name === "Test" && l.source === "phone"))

// ---------------------------------------------------------------- WhatsApp : rattacher un message reçu à son clic d'origine
await page.goto(`${BASE}/admin/leads/new`, { waitUntil: "networkidle" })
await page.fill('input[name="name"]', "Test WhatsApp")
await page.fill('input[name="phone"]', "97 555 666")
await page.selectOption('select[name="source"]', "whatsapp")
await page.fill('input[name="wa_ref"]', "Bonjour, je veux des infos\n\nRéf: E2B-SEED22")
await Promise.all([page.waitForURL(/\/admin\/leads\/[0-9a-f-]{36}/), page.getByRole("button", { name: "Créer le lead" }).click()])
const waLead = db.landing_leads.find((l) => l.first_name === "Test" && l.visitor_ref === "E2B-SEED22")
check("WhatsApp : lead créé depuis un message reçu, rattaché au clic d'origine (canal, source, campagne)", Boolean(waLead) && waLead.channel === "meta" && waLead.utm_source === "instagram" && waLead.utm_campaign === "bio" && waLead.source === "whatsapp")
check("WhatsApp : message de confirmation « rattaché au clic WhatsApp d'origine »", await page.getByText("rattaché au clic WhatsApp d'origine").isVisible())
check("WhatsApp : aucun identifiant publicitaire ni personnel copié depuis le clic", !waLead?.fbclid && !waLead?.visitor_id && !waLead?.ip && waLead?.tracking_consent === false)
check("WhatsApp : lead assigné au conseiller qui l'a saisi", waLead?.assigned_to === db.landing_staff[0].user_id)
check("WhatsApp : historique « 💬 WhatsApp reçu » et rattachement tracés", (await page.locator("main").innerText()).includes("💬 WhatsApp reçu") && db.landing_lead_activities.some((a) => a.type === "created" && a.body.includes("rattaché au clic")))
const before = db.landing_leads.length
await page.goto(`${BASE}/admin/leads/new`, { waitUntil: "networkidle" })
await page.fill('input[name="name"]', "Autre Nom")
await page.fill('input[name="phone"]', "97 555 777")
await page.selectOption('select[name="source"]', "whatsapp")
await page.fill('input[name="wa_ref"]', "Réf: E2B-SEED22")
await Promise.all([page.waitForURL(/\/admin\/leads\/[0-9a-f-]{36}/), page.getByRole("button", { name: "Créer le lead" }).click()])
check("WhatsApp : même référence = message ajouté au lead existant, AUCUN doublon", db.landing_leads.length === before && (await page.getByText(/aucun doublon créé/).isVisible()))
await page.goto(`${BASE}/admin/leads/new`, { waitUntil: "networkidle" })
await page.fill('input[name="name"]', "Sans Clic")
await page.fill('input[name="phone"]', "97 555 888")
await page.selectOption('select[name="source"]', "whatsapp")
await page.fill('input[name="wa_ref"]', "Réf: E2B-AUCUN2")
await Promise.all([page.waitForURL(/\/admin\/leads\/[0-9a-f-]{36}/), page.getByRole("button", { name: "Créer le lead" }).click()])
check("WhatsApp : référence sans clic retrouvé → « origine inconnue » (rien d'inventé)", (await page.getByText(/origine inconnue/).first().isVisible()) && !db.landing_leads.find((l) => l.visitor_ref === "E2B-AUCUN2").channel)
await page.fill('input[name="wa_ref"]', "").catch(() => {})
await page.goto(`${BASE}/admin/leads/new`, { waitUntil: "networkidle" })
await page.fill('input[name="name"]', "Mauvaise Ref")
await page.fill('input[name="phone"]', "97 555 999")
await page.fill('input[name="wa_ref"]', "texte sans aucune reference")
await page.getByRole("button", { name: "Créer le lead" }).click()
await page.getByText(/Référence WhatsApp introuvable/).waitFor({ timeout: 8000 }).catch(() => {})
check("WhatsApp : texte sans référence valide refusé avec un message clair", await page.getByText(/Référence WhatsApp introuvable/).isVisible())

// échanges saisis sur la fiche
await page.goto(`${BASE}/admin/leads/${waLead.id}`, { waitUntil: "networkidle" })
const inForm = page.locator("form").filter({ has: page.getByRole("button", { name: "💬 Message reçu" }) })
await inForm.locator('input[name="text"]').fill("Veut le prix pour 4 personnes")
await Promise.all([page.waitForURL(/ok=/), inForm.getByRole("button", { name: "💬 Message reçu" }).click()])
check("WhatsApp : « message reçu » saisi sur la fiche et tracé", db.landing_lead_activities.some((a) => a.lead_id === waLead.id && a.type === "wa_in" && a.body === "Veut le prix pour 4 personnes"))
await page.goto(`${BASE}/admin/leads/${waLead.id}`, { waitUntil: "networkidle" })
const outForm = page.locator("form").filter({ has: page.getByRole("button", { name: "💬 Message envoyé" }) })
await Promise.all([page.waitForURL(/ok=/), outForm.getByRole("button", { name: "💬 Message envoyé" }).click()])
check("WhatsApp : « message envoyé » saisi sur la fiche et tracé", db.landing_lead_activities.some((a) => a.lead_id === waLead.id && a.type === "wa_out"))

// onglet statistiques WhatsApp : chaque étape garde sa nature
await page.goto(`${BASE}/admin/stats?view=whatsapp`, { waitUntil: "networkidle" })
const waStats = await page.locator("main").innerText()
check("stats WhatsApp : clics observés, messages saisis, rattachement calculé, avertissement « non observable »", ["Clics WhatsApp", "Observé", "Saisi par l'équipe", "Calculé", "Conversations suivies", "Non observable sans l'API officielle"].every((t) => waStats.includes(t)))

// ---------------------------------------------------------------- scénario commercial complet (Bloc 5)
// prospect → conseiller → qualification → devis → négociation → réservation → gagné
{
  const id = LEAD(9) // « Slim » : prospect du formulaire, statut nouveau
  const row = () => db.landing_leads.find((l) => l.id === id)
  const goBoard = async () => page.goto(`${BASE}/admin/pipeline`, { waitUntil: "networkidle" })
  const card = () => page.locator(`a[href="/admin/leads/${id}"]`).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")
  const step = async (label, expected) => {
    await goBoard()
    await card().getByRole("button", { name: label }).click()
    await page.waitForTimeout(1100)
    check(`pipeline : « ${label} » → statut ${expected}`, row().status === expected, row().status)
  }
  // 1. affecter au conseiller et qualifier pendant l'échange
  await page.goto(`${BASE}/admin/leads/${id}`, { waitUntil: "networkidle" })
  await page.selectOption('select[name="assigned_to"]', db.landing_staff[1].user_id)
  await Promise.all([page.waitForURL(/ok=/), page.getByRole("button", { name: "Assigner" }).click()])
  check("scénario : lead affecté au conseiller", row().assigned_to === db.landing_staff[1].user_id)
  await page.selectOption('select[name="region"]', "Nabeul")
  await page.fill('input[name="budget"]', "4000 TND / pers.")
  await page.getByRole("button", { name: "Enregistrer la qualification" }).click()
  await page.getByText("Qualification enregistrée").waitFor({ timeout: 10000 }).catch(() => {})
  check("scénario : qualification (région, budget déclaré) enregistrée", row().region === "Nabeul" && row().budget === "4000 TND / pers.")
  // 2. avancer dans le pipeline, étape par étape
  await step("→ À contacter", "a_contacter")
  await step("→ Contacté", "contacte")
  await step("→ À qualifier", "a_qualifier")
  await step("→ Qualifié", "qualifie")
  await step("→ Devis / proposition", "devis")
  await step("→ En négociation", "negociation")
  // 3. la réservation exige un montant : le bouton mène à la fiche
  await goBoard()
  await card().getByRole("link", { name: /Réservé \(montant\)/ }).click()
  await page.waitForURL(new RegExp(`/admin/leads/${id}`))
  await page.selectOption('select[name="status"]', "reserve")
  await page.locator("form").filter({ hasText: "Changer le statut" }).getByRole("button", { name: "Enregistrer" }).click()
  await page.getByText("Montant de la réservation obligatoire").waitFor({ timeout: 8000 }).catch(() => {})
  check("scénario : « réservé » sans montant refusé", (await page.getByText("Montant de la réservation obligatoire").isVisible()) && row().status === "negociation")
  await page.selectOption('select[name="status"]', "reserve")
  await page.fill('input[name="booking_value"]', "9000")
  await page.locator("form").filter({ hasText: "Changer le statut" }).getByRole("button", { name: "Enregistrer" }).click()
  await page.getByText(/Statut enregistré/).waitFor({ timeout: 10000 }).catch(() => {})
  const bookedAt = row().booked_at
  check("scénario : réservation effectuée avec montant et date de réservation", row().status === "reserve" && Number(row().booking_value) === 9000 && Boolean(bookedAt))
  // 4. gagné : aucun nouveau montant, la date de réservation ne bouge pas
  await page.selectOption('select[name="status"]', "gagne")
  await page.locator("form").filter({ hasText: "Changer le statut" }).getByRole("button", { name: "Enregistrer" }).click()
  await page.waitForTimeout(1200)
  check("scénario : gagné — même montant, même date de réservation (vente comptée une seule fois)", row().status === "gagne" && Number(row().booking_value) === 9000 && row().booked_at === bookedAt)
  const trail = db.landing_lead_activities.filter((a) => a.lead_id === id && a.type === "status_change").map((a) => `${a.from_status}>${a.to_status}`)
  check("scénario : l'historique trace chaque étape avant / après", JSON.stringify(trail) === JSON.stringify(["nouveau>a_contacter", "a_contacter>contacte", "contacte>a_qualifier", "a_qualifier>qualifie", "qualifie>devis", "devis>negociation", "negociation>reserve", "reserve>gagne"]), trail.join(" | "))
  await page.goto(`${BASE}/admin/leads/${id}`, { waitUntil: "networkidle" })
  check("scénario : la fiche affiche le badge « Gagné »", (await page.locator("main").innerText()).includes("Gagné"))
  // 5. « Perdu » depuis une étape ouverte, puis réouverture
  await page.locator(`input[type=hidden][name=id]`).first().waitFor({ state: "attached" })
  await goBoard()
  const other = LEAD(8) // « Rim » : contacté
  await page.locator(`a[href="/admin/leads/${other}"]`).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]").getByRole("button", { name: "Perdu" }).click()
  await page.waitForTimeout(1100)
  check("pipeline : « Perdu » depuis une étape ouverte", db.landing_leads.find((l) => l.id === other).status === "perdu")
  await goBoard()
  await page.locator(`a[href="/admin/leads/${other}"]`).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]").getByRole("button", { name: "→ Rouvrir" }).click()
  await page.waitForTimeout(1100)
  check("pipeline : un lead perdu peut être rouvert (→ contacté)", db.landing_leads.find((l) => l.id === other).status === "contacte")
  // 6. liste : filtre « vendus » (réservé + gagné) et actions groupées sur les nouvelles étapes
  await page.goto(`${BASE}/admin?status=reserve,gagne`, { waitUntil: "networkidle" })
  const sold = await page.locator('input[name="ids"]').count()
  check("liste : le filtre « réservé + gagné » affiche les ventes", sold >= 2 && sold === db.landing_leads.filter((l) => l.status === "reserve" || l.status === "gagne").length, String(sold))
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" })
  const bulkOptions = await page.locator('select[name="bulk"] option').allInnerTexts()
  check("actions groupées : toutes les étapes sauf les ventes (montant requis)", ["À contacter", "À qualifier", "Devis / proposition", "En négociation", "Perdu"].every((t) => bulkOptions.includes(t)) && !bulkOptions.includes("Gagné") && !bulkOptions.includes("Réservé"))
  // 7. statistiques : la vente n'apparaît qu'une fois (vendus = réservé + gagné)
  await page.goto(`${BASE}/admin/stats`, { waitUntil: "networkidle" })
  const sellers = db.landing_leads.filter((l) => l.status === "reserve" || l.status === "gagne")
  const revenue = sellers.reduce((a, l) => a + (Number(l.booking_value) || 0), 0)
  const statsText = (await page.locator("main").innerText()).replace(/\u202f|\u00a0/g, " ")
  check("statistiques : « Vendus » = réservé + gagné, chiffre d'affaires sans double comptage", statsText.includes("Vendus") && statsText.includes(`CA : ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(revenue).replace(/\u202f|\u00a0/g, " ")} TND`), `CA attendu ${revenue}`)
}

// ---------------------------------------------------------------- Customer 360 (Bloc 6)
{
  // Ahmed (lead 1) et Walid (lead 7) partagent le même numéro : un seul client, deux demandes
  await page.goto(`${BASE}/admin/clients`, { waitUntil: "networkidle" })
  const rows = await page.locator("tr[data-phone]").evaluateAll((els) => els.map((e) => e.getAttribute("data-phone")))
  const shared = "21698140514"
  check("clients : un numéro partagé n'apparaît qu'une fois", rows.filter((r) => r === shared).length === 1, rows.join(","))
  check("clients : un client par numéro distinct", rows.length === new Set(db.landing_leads.filter((l) => l.phone).map((l) => l.phone)).size, String(rows.length))
  await page.fill('input[name="q"]', "98140514")
  await page.getByRole("button", { name: "Chercher" }).click()
  await page.waitForURL(/q=98140514/)
  check("clients : recherche par téléphone", (await page.locator("tr[data-phone]").count()) === 1)
  await page.locator(`tr[data-phone="${shared}"] a`).first().click()
  await page.waitForURL(new RegExp(`/admin/clients/${shared}`))
  const text = await page.locator("main").innerText()
  const mine = db.landing_leads.filter((l) => l.phone === shared)
  check("fiche client : toutes les demandes du numéro sont listées", mine.length >= 2 && mine.every((l) => text.includes(l.ref)))
  const acts = db.landing_lead_activities.filter((a) => mine.some((l) => l.id === a.lead_id))
  check("fiche client : la chronologie commune contient chaque activité", (await page.locator('[data-testid="client-timeline"] li').count()) === Math.max(1, acts.length), `${acts.length}`)
  check("fiche client : bloc consentements affiché", text.includes("Consentements"))
  await page.getByRole("link", { name: mine[0].ref }).click()
  await page.waitForURL(/\/admin\/leads\//)
  check("fiche client → fiche lead", /\/admin\/leads\//.test(page.url()))
  await page.getByRole("link", { name: /Voir le client/ }).click()
  await page.waitForURL(new RegExp(`/admin/clients/${shared}`))
  check("fiche lead → fiche client (360°)", page.url().includes(`/admin/clients/${shared}`))
  check("fiche client inconnue → 404", (await page.goto(`${BASE}/admin/clients/21600000001`)).status() === 404)
  check("clé invalide → 404 (aucune injection)", (await page.goto(`${BASE}/admin/clients/1;drop`)).status() === 404)
  // la vente du scénario Bloc 5 (Slim) apparaît côté client avec son chiffre d'affaires
  await page.goto(`${BASE}/admin/clients/21677889900`, { waitUntil: "networkidle" })
  const stats = await page.locator('[data-testid="client-stats"]').innerText()
  check("fiche client : ventes et CA du client (réservé → gagné compté une fois)", /Ventes[^\n]*\n?/.test(stats) && stats.replace(/\s/g, " ").includes("9") , stats.replace(/\n/g, " | "))
}

// ---------------------------------------------------------------- Segments (Bloc 7) : aucun envoi
{
  const sendsBefore = db.landing_lead_activities.length
  await page.goto(`${BASE}/admin/segments`, { waitUntil: "networkidle" })
  const cards = await page.locator("[data-segment]").count()
  check("segments : 8 segments affichés (dont VIP)", cards === 8, String(cards))
  const txt = await page.locator("main").innerText()
  check("segments : mention explicite « rien n'est envoyé »", txt.includes("Rien n'est envoyé") || txt.includes("n'est envoyé"))
  // « À traiter » : au moins le lead Fatma (nouveau) ; tous les membres affichés ont un statut nouveau / à contacter
  await page.locator('[data-segment="a-traiter"]').click()
  await page.waitForURL(/s=a-traiter/)
  const statuses = await page.locator('[data-testid="segment-members"] tr[data-phone] td:nth-child(2)').allInnerTexts()
  check("segments : « À traiter » ne contient que nouveau / à contacter", statuses.length >= 1 && statuses.every((t) => t === "Nouveau" || t === "À contacter"), statuses.join(","))
  // marketing : aucun client sans consentement marketing dans la liste contactable
  for (const slug of ["perdus-recuperables", "omra-sans-reservation", "clients-reserves"]) {
    await page.goto(`${BASE}/admin/segments?s=${slug}`, { waitUntil: "networkidle" })
    const phones = await page.locator('[data-testid="segment-members"] tr[data-phone]').evaluateAll((els) => els.map((e) => e.getAttribute("data-phone")))
    const bad = phones.filter((ph) => db.landing_leads.some((l) => l.phone === ph && (!l.marketing_consent || l.marketing_withdrawn_at)))
    check(`segments : « ${slug} » exclut tout client sans consentement marketing`, bad.length === 0, bad.join(","))
  }
  check("segments : la consultation n'écrit rien (aucune activité créée)", db.landing_lead_activities.length === sendsBefore)
}

// ---------------------------------------------------------------- Analytics : entonnoir (Bloc 9)
{
  const writesBefore = db.landing_lead_activities.length + db.landing_leads.length
  const from = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10)
  const to = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  await page.goto(`${BASE}/admin/stats?view=entonnoir&from=${from}&to=${to}`, { waitUntil: "networkidle" })
  const steps = await page.locator("[data-step]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-step"), Number(e.querySelector("[data-count]").textContent)]))
  const c = Object.fromEntries(steps)
  check("entonnoir : 6 étapes dans l'ordre", steps.map((x) => x[0]).join() === "recus,contactes,qualifies,propositions,reserves,gagnes", steps.map((x) => x[0]).join())
  const inPeriod = db.landing_leads.filter((l) => Date.parse(l.created_at) >= Date.parse(from) && Date.parse(l.created_at) <= Date.parse(to))
  check("entonnoir : « reçus » = leads de la période", c.recus === inPeriod.length, `${c.recus} vs ${inPeriod.length}`)
  check("entonnoir : monotone décroissant", steps.every((x, i) => i === 0 || x[1] <= steps[i - 1][1]), JSON.stringify(steps))
  const sold = inPeriod.filter((l) => l.status === "reserve" || l.status === "gagne").length
  check("entonnoir : « réservés » ≥ ventes actuelles (réservé + gagné, une fois chacune)", c.reserves >= sold && c.gagnes >= 1, `${c.reserves}/${sold}/${c.gagnes}`)
  const resp = await page.locator('[data-testid="response"]').innerText()
  check("entonnoir : délais de premier traitement affichés", /Délai médian/.test(resp) && /Jamais traités/.test(resp))
  const dayRows = await page.locator('[data-testid="daily"] tr[data-day]').count()
  check("entonnoir : une ligne par jour de la période", dayRows >= 40, String(dayRows))
  check("entonnoir : la consultation n'écrit rien (ni lead ni activité)", db.landing_lead_activities.length + db.landing_leads.length === writesBefore)
}

// ---------------------------------------------------------------- Fidélité (Bloc 8) : seuil de test 10 000 TND
{
  const KARIM = "21699001122" // vendu 15 600 → VIP
  const HELA = "21633221100" // vendu 7 800 → Fidèle
  const SAMI = "21655443322" // aucune vente → aucun niveau
  const writesBefore = db.landing_lead_activities.length + db.landing_leads.length
  await page.goto(`${BASE}/admin/clients`, { waitUntil: "networkidle" })
  const tier = async (phone) => (await page.locator(`tr[data-phone="${phone}"] td[data-tier]`).first().getAttribute("data-tier"))
  check("fidélité : 15 600 TND cumulés → VIP", (await tier(KARIM)) === "vip", String(await tier(KARIM)))
  check("fidélité : 7 800 TND cumulés → Fidèle (sous le seuil)", (await tier(HELA)) === "fidele", String(await tier(HELA)))
  check("fidélité : aucune vente → aucun niveau", (await tier(SAMI)) === "", String(await tier(SAMI)))
  await page.goto(`${BASE}/admin/clients/${KARIM}`, { waitUntil: "networkidle" })
  check("fiche client : badge VIP", (await page.locator('[data-testid="tier"]').innerText()).trim() === "VIP")
  const loyalty = await page.locator('[data-testid="loyalty"]').innerText()
  check("fiche client : fidélité explique le calcul (CA cumulé, seuil, aucun avantage automatique)", /15\s?600/.test(loyalty.replace(/[\u202f\u00a0]/g, " ")) && /Seuil VIP/.test(loyalty) && /Aucun avantage automatique/.test(loyalty), loyalty.replace(/\n/g, " | "))
  // segment VIP : le client VIP est compté ; sans consentement marketing il est exclu de la liste contactable
  await page.goto(`${BASE}/admin/segments`, { waitUntil: "networkidle" })
  const vipCard = await page.locator('[data-segment="vip"]').innerText()
  const karimConsent = db.landing_leads.some((l) => l.phone === KARIM && l.marketing_consent && !l.marketing_withdrawn_at)
  check("segment VIP : un client VIP sans consentement marketing est exclu, avec ou sans consentement il est compté", karimConsent ? /^\s*VIP|Clients VIP/.test(vipCard) : /exclu/.test(vipCard), vipCard.replace(/\n/g, " | "))
  check("fidélité : consultation en lecture seule", db.landing_lead_activities.length + db.landing_leads.length === writesBefore)
}

// ---------------------------------------------------------------- statistiques
for (const [label, path, text] of [["marketing", "/admin/stats", "Leads reçus"], ["équipe", "/admin/stats?view=equipe", "Taux de conclusion"], ["offres", "/admin/stats?view=offres", "Offre"], ["calculateur", "/admin/calculateur", "Profit net"]]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" })
  check(`${label} : page affichée`, await page.getByText(text).first().isVisible())
}
await page.goto(`${BASE}/admin/calculateur`, { waitUntil: "networkidle" })
await page.getByLabel("Prix de vente par personne").fill("5500")
await page.getByLabel("Coût du forfait par personne").fill("4800")
check("calculateur : le profit se recalcule à la saisie", /TND/.test(await page.getByText("Profit net").locator("xpath=..").innerText()))

// ---------------------------------------------------------------- catalogue
await page.goto(`${BASE}/admin/catalogue/offres/new`, { waitUntil: "networkidle" })
await page.fill('input[name="name"]', "Turquie 8 jours")
await page.fill('input[name="price"]', "2450")
await page.fill('input[name="cost"]', "1900")
await page.fill('input[name="seats_total"]', "30")
await page.fill('input[name="seats_sold"]', "40")
await page.getByRole("button", { name: "Enregistrer" }).click()
await page.getByText("Plus de places vendues que de places totales").waitFor({ timeout: 8000 }).catch(() => {})
check("catalogue : places vendues > totales refusé", await page.getByText("Plus de places vendues que de places totales").isVisible())
await page.fill('input[name="seats_sold"]', "4")
await page.locator('input[type="file"][name="image_file"]').setInputFiles({ name: "tr.png", mimeType: "image/png", buffer: png })
await page.getByRole("button", { name: "Enregistrer" }).click()
await page.waitForURL(/\/admin\/catalogue\/offres\/[0-9a-f-]{36}\?ok=1/, { timeout: 15000 }).catch(async () => {
  console.log("  … pas de redirection ; message affiché :", (await page.locator("form").first().innerText()).replace(/\s+/g, " ").slice(0, 300))
})
const offer = db.landing_offers.find((o) => o.name === "Turquie 8 jours")
check("catalogue : offre créée (copie masquée par défaut)", Boolean(offer) && offer.visible === false && Number(offer.price) === 2450 && Number(offer.cost) === 1900)
check("catalogue : image envoyée au stockage et lien enregistré", fake.calls.some((c) => c.startsWith("POST /storage/v1/object/landing-media/offers/")) && /\/storage\/v1\/object\/public\/landing-media\/offers\/.+\.png$/.test(offer?.image_url || ""))
await page.getByLabel("Affichée sur le site").check()
await page.fill('input[name="seats_sold"]', "28")
await page.getByRole("button", { name: "Enregistrer" }).click()
await page.getByText("Offre enregistrée").waitFor({ timeout: 8000 }).catch(() => {})
check("catalogue : modification enregistrée (affichée, 28 places vendues)", db.landing_offers.find((o) => o.id === offer.id).visible === true && db.landing_offers.find((o) => o.id === offer.id).seats_sold === 28)
await page.goto(`${BASE}/admin/catalogue`, { waitUntil: "networkidle" })
await page.getByRole("row", { name: /Turquie 8 jours/ }).getByRole("button", { name: "Dupliquer" }).click()
await page.waitForURL(/ok=copie/, { timeout: 10000 }).catch(() => {})
check("catalogue : dupliquer crée une copie masquée sans SKU ni places vendues", db.landing_offers.some((o) => o.name === "Turquie 8 jours (copie)" && o.visible === false && o.seats_sold === 0))
await page.goto(`${BASE}/admin/catalogue`, { waitUntil: "networkidle" })
await page.getByRole("row", { name: /Turquie 8 jours \(copie\)/ }).getByRole("button", { name: "Archiver" }).click()
await page.waitForTimeout(1200)
check("catalogue : archiver une offre", Boolean(db.landing_offers.find((o) => o.name === "Turquie 8 jours (copie)")?.archived_at))
await page.goto(`${BASE}/admin/catalogue/categories/new`, { waitUntil: "networkidle" })
await page.fill('input[name="name"]', "Égypte croisière 2027")
await Promise.all([page.waitForURL(/categories\/[0-9a-f-]{36}\?ok=1/, { timeout: 15000 }), page.getByRole("button", { name: "Enregistrer" }).click()])
check("catalogue : catégorie créée avec adresse automatique", db.landing_categories.some((c) => c.slug === "egypte-croisiere-2027"))

// ---------------------------------------------------------------- codes promo
await page.goto(`${BASE}/admin/promos`, { waitUntil: "networkidle" })
check("promos : liste avec statuts (actif, expiré)", (await page.getByText("Actif", { exact: true }).count()) >= 1 && (await page.getByText("Expiré", { exact: true }).count()) >= 1)
await page.fill('input[name="code"]', "ete 2027")
await page.fill('input[name="title"]', "Offre été")
await page.fill('input[name="discountValue"]', "150")
await page.selectOption('select[name="discountType"]', "percent")
await page.getByRole("button", { name: "Créer le code" }).click()
await page.getByText("Entre 1 et 100 %").waitFor({ timeout: 8000 }).catch(() => {})
check("promos : pourcentage > 100 refusé", await page.getByText("Entre 1 et 100 %").isVisible())
await page.fill('input[name="discountValue"]', "15")
await page.getByRole("button", { name: "Créer le code" }).click()
await page.getByText("Code promo créé").waitFor({ timeout: 8000 }).catch(() => {})
check("promos : code créé et normalisé en majuscules", db.landing_promo_codes.some((c) => c.code === "ETE2027" && Number(c.discount_value) === 15))
await page.goto(`${BASE}/admin/promos`, { waitUntil: "networkidle" })
await page.getByRole("row", { name: /ETE2027/ }).getByRole("button", { name: "Désactiver" }).click()
await page.waitForTimeout(1000)
check("promos : désactiver un code", db.landing_promo_codes.find((c) => c.code === "ETE2027").active === false)

// ---------------------------------------------------------------- protection
await page.goto(`${BASE}/admin/protection`, { waitUntil: "networkidle" })
await page.locator('input[name="value"]').first().fill("98 111 222")
await page.getByRole("button", { name: "Bloquer le numéro" }).click()
await page.getByText("Numéro bloqué").waitFor({ timeout: 8000 }).catch(() => {})
check("protection : numéro bloqué (normalisé en 216…)", db.landing_blocklist.some((b) => b.kind === "phone" && b.value === "21698111222" && b.active))
await page.locator('input[name="value"]').nth(1).fill("999.1.1.1")
await page.getByRole("button", { name: "Bloquer l'IP" }).click()
await page.getByText("Adresse IP invalide").waitFor({ timeout: 8000 }).catch(() => {})
check("protection : IP invalide refusée", await page.getByText("Adresse IP invalide").isVisible())
await page.goto(`${BASE}/admin/protection`, { waitUntil: "networkidle" })
await page.getByRole("listitem").filter({ hasText: "+21698111222" }).getByRole("button", { name: "Débloquer" }).click()
await page.waitForTimeout(1000)
check("protection : débloquer un numéro", db.landing_blocklist.find((b) => b.value === "21698111222").active === false)

// ---------------------------------------------------------------- intégrations
await page.goto(`${BASE}/admin/integrations`, { waitUntil: "networkidle" })
const meta = page.locator("section").filter({ hasText: "Meta (Facebook / Instagram)" }).first()
await meta.locator('input[name="pixelId"]').fill("tarhouni.hassene@gmail.com")
await meta.getByRole("button", { name: "Enregistrer" }).click()
await meta.getByText(/15 à 17 chiffres/).first().waitFor({ timeout: 8000 }).catch(() => {})
check("intégrations : adresse e-mail refusée comme ID de pixel", db.landing_integrations.length === 0)
await meta.locator('input[name="pixelId"]').fill("1674012850599992")
const token = `EAA${"B".repeat(150)}`
await meta.locator('input[name="token"]').fill(token)
await meta.getByRole("button", { name: "Enregistrer" }).click()
await meta.getByText(/Enregistré\./).waitFor({ timeout: 8000 }).catch(() => {})
const saved = db.landing_integrations.find((i) => i.provider === "meta")
check("intégrations : jeton enregistré chiffré (jamais en clair)", Boolean(saved) && saved.token_ciphertext.startsWith("v1:") && !JSON.stringify(db).includes(token) && saved.token_last4 === "BBBB")
await page.goto(`${BASE}/admin/integrations`, { waitUntil: "networkidle" })
check("intégrations : l'écran n'affiche que « ••••BBBB »", (await page.content()).includes("••••BBBB") && !(await page.content()).includes(token))

// ---------------------------------------------------------------- équipe, modèles, compte
await page.goto(`${BASE}/admin/equipe`, { waitUntil: "networkidle" })
await page.fill('input[name="email"]', "nouveau@easy2book.tn")
await page.fill('input[name="full_name"]', "Nouvel Agent")
await page.getByRole("button", { name: "Ajouter le membre" }).click()
await page.getByText(/mot de passe provisoire/i).first().waitFor({ timeout: 8000 }).catch(() => {})
const temp = (await page.locator("code").filter({ hasText: /^[A-Za-z0-9]{14}$/ }).first().innerText().catch(() => "")).trim()
check("équipe : membre ajouté, mot de passe provisoire de 14 caractères affiché", temp.length === 14 && db.landing_staff.some((s) => s.email === "nouveau@easy2book.tn" && s.role === "agent"))
check("équipe : le mot de passe n'est écrit ni en base ni dans le journal", !JSON.stringify(db).includes(temp) && db.landing_admin_log.some((l) => l.summary.includes("nouveau@easy2book.tn")))
await page.goto(`${BASE}/admin/equipe`, { waitUntil: "networkidle" })
await page.getByRole("row", { name: /nouveau@easy2book.tn/ }).getByRole("button", { name: /Désactiver/ }).click()
await page.waitForTimeout(1000)
check("équipe : désactiver l'accès d'un membre", db.landing_staff.find((s) => s.email === "nouveau@easy2book.tn").active === false)
check("équipe : l'administrateur connecté ne peut pas se désactiver (pas de bouton)", (await page.getByRole("row", { name: /direction@easy2book.tn/ }).getByRole("button", { name: /Désactiver/ }).count()) === 0)

await page.goto(`${BASE}/admin/modeles`, { waitUntil: "networkidle" })
const form = page.locator("form").filter({ hasText: "Enregistrer" }).first()
await form.locator('input[name="title"]').fill("Relance J+3")
await form.locator('textarea[name="body"]').fill("Bonjour {prenom}, avez-vous pu réfléchir à {offre} ? ({ref})")
await form.getByRole("button", { name: "Enregistrer" }).click()
await page.getByText("Modèle enregistré").first().waitFor({ timeout: 8000 }).catch(() => {})
check("modèles : nouveau modèle enregistré", db.landing_message_templates.some((t) => t.title === "Relance J+3"))

await page.goto(`${BASE}/admin/compte`, { waitUntil: "networkidle" })
await page.fill('input[name="password"]', "NouveauMdp-2027")
await page.fill('input[name="confirm"]', "autre-chose-123")
await page.getByRole("button", { name: "Changer le mot de passe" }).click()
await page.getByText("ne correspondent pas").waitFor({ timeout: 8000 }).catch(() => {})
check("compte : deux mots de passe différents refusés", await page.getByText("ne correspondent pas").isVisible())
await page.fill('input[name="confirm"]', "NouveauMdp-2027")
await page.getByRole("button", { name: "Changer le mot de passe" }).click()
await page.getByText("Mot de passe modifié").waitFor({ timeout: 8000 }).catch(() => {})
check("compte : mot de passe changé", fake.users.find((u) => u.email === ADMIN.email).password === "NouveauMdp-2027")
fake.users.find((u) => u.email === ADMIN.email).password = ADMIN.password

// ---------------------------------------------------------------- export
const exp = await page.request.get(`${BASE}/admin/export`)
check("export CSV : accessible à l'administrateur", exp.status() === 200 && (exp.headers()["content-type"] || "").includes("csv"), String(exp.status()))

// déconnexion
await page.getByRole("button", { name: "Déconnexion" }).first().click()
await page.waitForURL(/\/admin\/login/, { timeout: 10000 }).catch(() => {})
check("déconnexion : retour à la page de connexion", page.url().includes("/admin/login"))
await page.goto(`${BASE}/admin/catalogue`)
check("déconnecté : /admin/catalogue protégé", page.url().includes("/admin/login"))
await ctx.close()

// ---------------------------------------------------------------- agent : droits limités
{
  const { ctx: actx, page: ap } = await session(AGENT)
  const aside = ap.locator("aside")
  check("agent : menu sans Catalogue, Intégrations, Équipe…", (await aside.getByRole("link", { name: /Intégrations|Offres et catégories|Équipe|Protection|Codes promo|Modèles|Export/ }).count()) === 0)
  check("agent : voit Leads, Pipeline, Statistiques", (await aside.getByRole("link", { name: "Pipeline", exact: true }).isVisible()) && (await aside.getByRole("link", { name: "Statistiques", exact: true }).isVisible()))
  for (const path of ["/admin/integrations", "/admin/catalogue", "/admin/equipe", "/admin/promos", "/admin/protection", "/admin/modeles"]) {
    await ap.goto(`${BASE}${path}`, { waitUntil: "networkidle" })
    if (!(await ap.getByText("réservée aux administrateurs").isVisible())) check(`agent : ${path} refusé`, false)
  }
  const aexp = await ap.request.get(`${BASE}/admin/export`)
  check("agent : export CSV refusé (403)", aexp.status() === 403, String(aexp.status()))
  const before = db.landing_integrations.length
  await ap.goto(`${BASE}/admin`, { waitUntil: "networkidle" })
  check("agent : accède aux leads", (await ap.locator('input[name="ids"]').count()) > 0 && db.landing_integrations.length === before)
  await actx.close()
}

// ---------------------------------------------------------------- mobile : menu tiroir
{
  const { ctx: mctx, page: mp } = await session(ADMIN, { width: 390, height: 844 })
  check("mobile : barre haute avec bouton menu, sans menu latéral visible", (await mp.getByRole("button", { name: "Ouvrir le menu" }).isVisible()) && !(await mp.locator("aside").isVisible()))
  await mp.getByRole("button", { name: "Ouvrir le menu" }).click()
  check("mobile : le tiroir affiche le menu", await mp.getByRole("dialog").getByRole("link", { name: "Pipeline", exact: true }).isVisible())
  await mp.getByRole("dialog").getByRole("link", { name: "Pipeline", exact: true }).click()
  await mp.waitForURL(/\/admin\/pipeline/)
  await settle(mp)
  check("mobile : le tiroir se ferme après le choix d'une page", (await mp.getByRole("dialog").count()) === 0)
  await mp.getByRole("button", { name: "Ouvrir le menu" }).click()
  await mp.keyboard.press("Escape")
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  check("mobile : aucun défilement horizontal de la page", !overflow)
  await mctx.close()
}

check("aucune erreur JavaScript dans le navigateur", errors.length === 0, errors.slice(0, 3).join(" | "))
await browser.close()
await fake.close()
console.log(failed ? `\n${failed} échec(s)` : "\nparcours admin OK")
process.exit(failed ? 1 : 0)
