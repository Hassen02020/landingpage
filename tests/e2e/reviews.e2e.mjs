// Avis en étoiles des visiteurs (page /omra) — navigateur réel contre un FAUX Supabase en mémoire ; rien n'est écrit dans la vraie base.
//   Règle vérifiée : un avis déposé par un visiteur reste INVISIBLE jusqu'à sa validation par l'administrateur.
import { createRequire } from "node:module"
import { createFakeSupabase, ADMIN } from "./fake-supabase.mjs"
const { chromium } = createRequire(import.meta.url)("playwright")

const BASE = process.argv[2] || "http://localhost:3458"
const fake = createFakeSupabase({ tenant: process.env.FAKE_TENANT === "1" })
await fake.listen(54321)
const db = fake.db
let failed = 0
const check = (label, ok, extra = "") => { console.log(`${ok ? "✓" : "✗"} ${label}${ok || !extra ? "" : ` — ${extra}`}`); if (!ok) failed++ }

const browser = await chromium.launch()
const errors = []
const visitor = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-TN" })).newPage()
visitor.on("pageerror", (e) => errors.push(e.message))
const adminCtx = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: "fr-FR" })
const admin = await adminCtx.newPage()
admin.on("pageerror", (e) => errors.push(e.message))

const apiReviews = async () => (await (await visitor.request.get(`${BASE}/api/reviews?page=omra`)).json())
const open = async () => {
  const loaded = visitor.waitForResponse((r) => r.url().includes("/api/reviews?page=omra") && r.request().method() === "GET", { timeout: 20000 })
  await visitor.goto(`${BASE}/omra`, { waitUntil: "domcontentloaded" })
  await loaded
  await visitor.locator("#avis").scrollIntoViewIfNeeded()
  await visitor.waitForTimeout(500)
}

// 1. rien de publié au départ : aucune moyenne, aucun avis inventé
await open()
check("la section « avis » est présente sur /omra", (await visitor.locator('[data-testid="reviews"]').count()) === 1)
check("sans avis publié : message « aucun avis », aucune moyenne", (await visitor.locator('[data-testid="reviews-empty"]').count()) === 1 && (await visitor.locator('[data-testid="reviews-average"]').count()) === 0)

// 2. validations côté formulaire (note, prénom, accord obligatoires)
await visitor.click('[data-testid="reviews-form"] button[type=submit]')
await visitor.waitForTimeout(500)
const msgs = await visitor.locator('[data-testid="reviews-form"] [role=alert]').allInnerTexts()
check("envoi vide refusé : note, prénom et accord de publication réclamés", msgs.length >= 3, msgs.join(" | "))
check("rien n'a été enregistré", db.landing_reviews.length === 0)

// 3. dépôt d'un avis valide
await visitor.click('[data-testid="reviews-form"] label:nth-of-type(5)') // 5e étoile
await visitor.fill("#avis-nom", "Amine")
await visitor.fill("#avis-com", "رحلة منظمة جداً والفريق محترف")
await visitor.check('[data-testid="reviews-form"] input[type=checkbox]')
await visitor.click('[data-testid="reviews-form"] button[type=submit]')
await visitor.waitForSelector('[data-testid="reviews-thanks"]', { timeout: 8000 })
check("message de remerciement : « votre avis apparaîtra après vérification »", (await visitor.locator('[data-testid="reviews-thanks"]').innerText()).includes("بعد مراجعته"))
check("avis enregistré EN ATTENTE (note 5, prénom, accord)", db.landing_reviews.length === 1 && db.landing_reviews[0].status === "pending" && db.landing_reviews[0].rating === 5 && db.landing_reviews[0].first_name === "Amine" && db.landing_reviews[0].publish_consent === true, JSON.stringify(db.landing_reviews[0]))
check("aucune IP, téléphone ni e-mail conservés avec l'avis", !Object.keys(db.landing_reviews[0]).some((k) => /ip|phone|email|user_agent/.test(k)))

// 4. INVISIBLE tant qu'il n'est pas validé
await open()
const body1 = await visitor.locator("body").innerText()
check("l'avis en attente n'apparaît PAS sur la page publique", !body1.includes("Amine") && !body1.includes("رحلة منظمة جداً") && (await visitor.locator('[data-testid="reviews-average"]').count()) === 0)
check("l'API publique ne renvoie aucun avis (compte 0, moyenne nulle)", JSON.stringify(await apiReviews()) === JSON.stringify({ count: 0, average: null, reviews: [] }))

// 5. l'administrateur le voit « à valider » et le publie
await admin.goto(`${BASE}/admin/login`)
await admin.fill("input[name=email]", ADMIN.email)
await admin.fill("input[name=password]", ADMIN.password)
await Promise.all([admin.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 15000 }), admin.click("button[type=submit]")])
await admin.goto(`${BASE}/admin/avis`, { waitUntil: "networkidle" })
check("menu : entrée « Avis des visiteurs »", (await admin.locator('a[href="/admin/avis"]').count()) >= 1)
check("l'avis est listé « à valider » avec son prénom, sa note et son commentaire", (await admin.locator('[data-testid="review-row"]').count()) === 1 && (await admin.locator('[data-testid="review-row"]').innerText()).includes("Amine"))
await admin.click('[data-testid="review-row"] button[value="published"]')
await admin.waitForTimeout(1200)
check("après « Publier » : statut publié avec date de modération ; la note et le texte sont inchangés", db.landing_reviews[0].status === "published" && !!db.landing_reviews[0].moderated_at && db.landing_reviews[0].rating === 5 && db.landing_reviews[0].comment.includes("منظمة"))

// 6. visible pour le public avec la moyenne calculée sur l'avis publié
await open()
check("l'avis publié apparaît, avec « 5.0 / 5 · 1 »", (await visitor.locator('[data-testid="reviews-average"]').innerText()).includes("5.0 / 5") && (await visitor.locator('[data-testid="reviews-list"]').innerText()).includes("Amine"))
check("aucun balisage Google de note (aggregateRating) dans la page", !(await visitor.content()).includes("aggregateRating"))

// 7. retrait : disparaît aussitôt du public
await admin.goto(`${BASE}/admin/avis?status=published`, { waitUntil: "networkidle" })
await admin.click('[data-testid="review-row"] button[value="rejected"]')
await admin.waitForTimeout(1200)
check("après « Retirer » : plus visible, moyenne supprimée", db.landing_reviews[0].status === "rejected" && JSON.stringify(await apiReviews()) === JSON.stringify({ count: 0, average: null, reviews: [] }))

// 8. protections : champ piège (robot), anti-spam, limitation de débit
const base = { page: "omra", rating: 4, consent: true }
const send = (o) => visitor.request.post(`${BASE}/api/reviews`, { data: { ...base, ...o } })
const bot = await send({ name: "Robot", comment: "ok", website: "http://spam.test" })
check("robot (champ piège rempli) : réponse « reçu » mais rien n'est enregistré", bot.status() === 201 && !db.landing_reviews.some((r) => r.first_name === "Robot"))
const spam = await send({ name: "Pub", comment: "visitez https://promo.test" })
check("commentaire avec adresse web : refusé (400)", spam.status() === 400)
const noConsent = await visitor.request.post(`${BASE}/api/reviews`, { data: { ...base, name: "Sami", consent: false } })
check("sans accord de publication : refusé (400)", noConsent.status() === 400)
const evil = await visitor.request.post(`${BASE}/api/reviews`, { data: { ...base, name: "Eve" }, headers: { origin: "https://evil.test" } })
check("origine d'un autre site : refusée (403)", evil.status() === 403)
const injected = await send({ name: "Karim", comment: "bien", status: "published", moderated_at: "2026-01-01", organization_id: "x" })
check("un visiteur ne peut pas imposer le statut « publié » : l'avis reste en attente", injected.status() === 201 && db.landing_reviews.find((r) => r.first_name === "Karim")?.status === "pending")
let last = 0
for (let i = 0; i < 4; i++) last = (await send({ name: `Visiteur${i}`, comment: `avis ${i}` })).status()
check("limitation de débit : au-delà de 3 avis par heure et par adresse, 429", last === 429, String(last))

check("aucune erreur JavaScript pendant tout le parcours", errors.length === 0, errors.join(" | "))
await browser.close()
fake.server?.close?.()
console.log(failed ? `\n${failed} échec(s)` : "\navis des visiteurs : parcours OK")
process.exit(failed ? 1 : 0)
