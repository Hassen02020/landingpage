// Faux Supabase EN MÉMOIRE pour tester l'interface /admin de bout en bout, sans toucher à la vraie base.
// Implémente juste ce que le site utilise : Auth (mot de passe, jeton, admin), REST (PostgREST : filtres
// courants, insertion, mise à jour, upsert, rpc) et Storage. Données d'exemple incluses.
//   node tests/e2e/fake-supabase.mjs 54321
import http from "node:http"
import { randomUUID } from "node:crypto"

export const ADMIN = { email: "direction@easy2book.tn", password: "Test-Passw0rd!" }
export const AGENT = { email: "agent@easy2book.tn", password: "Agent-Passw0rd!" }

const day = (n) => new Date(Date.now() - n * 86_400_000).toISOString()
const jwt = () => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url")
  return `${b({ alg: "HS256", typ: "JWT" })}.${b({ exp: Math.floor(Date.now() / 1000) + 3600 })}.sig${randomUUID().slice(0, 8)}`
}

const E2B_ORG = "00000000-0000-4000-8000-0000000e2b01"
const TENANT_TABLES = ["landing_leads", "landing_events", "landing_lead_activities", "landing_staff", "landing_integrations", "landing_integration_changes", "landing_admin_log", "landing_protection", "landing_blocklist", "landing_categories", "landing_offers", "landing_promo_codes", "landing_message_templates"]

// tenant: true → joue la base APRÈS la migration 0008 avec UNE organisation (Easy2Book) : table organizations présente,
// lignes rattachées, organization_id par défaut à l'insertion (comme le DEFAULT de la vraie base).
export const BOB_ORG = "00000000-0000-4000-8000-0000000000b0"
export const BOB = { email: "bob@bob-sarl.tn", password: "Bob-Passw0rd!", id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }

// multi: true → DEUX entreprises dans la même base (Easy2Book et « Bob SARL »), chacune avec son administrateur, ses leads et son équipe.
export function createFakeSupabase({ tenant = false, multi = false } = {}) {
  if (multi) tenant = true
  const ADMIN_ID = "11111111-1111-4111-8111-111111111111"
  const AGENT_ID = "22222222-2222-4222-8222-222222222222"
  const users = [
    { id: ADMIN_ID, email: ADMIN.email, password: ADMIN.password },
    { id: AGENT_ID, email: AGENT.email, password: AGENT.password },
  ]
  const sessions = new Map() // access_token → user id
  const refresh = new Map() // refresh_token → user id
  const calls = []

  const lead = (i, o) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    created_at: day(o.age ?? i),
    updated_at: day(o.age ?? i),
    lead_day: day(o.age ?? i).slice(0, 10),
    ref: `E2B-${String(100000 + i * 7919).replace(/[01]/g, "A")}`.slice(0, 10),
    visitor_ref: null,
    last_name: null,
    adults: 2,
    children: 0,
    status: "nouveau",
    booking_value: null,
    booked_at: null,
    notes: null,
    source: "form",
    assigned_to: null,
    next_follow_up_at: null,
    marketing_consent: false,
    tracking_consent: false,
    anonymized_at: null,
    channel: "meta",
    utm_source: "facebook",
    utm_campaign: "omra-2027",
    utm_term: "femmes-35-55",
    utm_content: "video-1",
    campaign_id: null,
    adset_id: null,
    ad_id: null,
    landing_page: "/omra",
    ...o,
  })
  const OFFER = {
    a: "الفوج الأول — 27 جانفي 2027",
    b: "الفوج الثاني — 18 فيفري 2027",
    c: "عمرة شوال — 15 مارس 2027",
  }
  const db = {
    landing_staff: [
      { user_id: ADMIN_ID, email: ADMIN.email, full_name: "Direction", role: "admin", active: true, created_at: day(40) },
      { user_id: AGENT_ID, email: AGENT.email, full_name: "Agent Sami", role: "agent", active: true, created_at: day(20) },
    ],
    landing_leads: [
      lead(1, { first_name: "Ahmed", last_name: "Ben Ali", phone: "21698140514", product: "omra", offer: OFFER.b, age: 0.1, offer_id: "aaaaaaaa-0000-4000-8000-000000000002" }),
      lead(2, { first_name: "Fatma", last_name: "Trabelsi", phone: "21622123456", product: "omra", offer: OFFER.a, age: 0.3, channel: "tiktok", utm_source: "tiktok", utm_campaign: "omra-tiktok", utm_content: "ugc-2" }),
      lead(3, { first_name: "Sami", last_name: "Gharbi", phone: "21655443322", product: "omra", offer: OFFER.c, status: "contacte", assigned_to: AGENT_ID, age: 1, next_follow_up_at: day(0.5) }),
      lead(4, { first_name: "Mariem", phone: "21698765432", product: "voyage", offer: "Turquie 8 jours", destination: "Istanbul", status: "qualifie", assigned_to: ADMIN_ID, age: 2, next_follow_up_at: day(-1) }),
      lead(5, { first_name: "Karim", last_name: "Jlassi", phone: "21699001122", product: "omra", offer: OFFER.b, status: "reserve", booking_value: 15600, booked_at: day(1), assigned_to: AGENT_ID, age: 4, adults: 2, promo_code: "RAMADAN27", offer_id: "aaaaaaaa-0000-4000-8000-000000000002" }),
      lead(6, { first_name: "Nadia", phone: "21623456789", product: "hotel", offer: "Hammamet 3 nuits", status: "perdu", age: 5, channel: "direct", utm_source: null, utm_campaign: null }),
      lead(7, { first_name: "Walid", phone: "21698140514", product: "omra", offer: OFFER.a, age: 6, channel: "whatsapp" }),
      lead(8, { first_name: "Rim", last_name: "Hamdi", phone: "21644556677", product: "omra", offer: OFFER.c, status: "contacte", age: 7 }),
      lead(9, { first_name: "Slim", phone: "21677889900", product: "voyage", offer: "Égypte croisière", status: "nouveau", age: 8, channel: "organic", utm_campaign: null }),
      lead(10, { first_name: "Hela", last_name: "Zouari", phone: "21633221100", product: "omra", offer: OFFER.b, status: "reserve", booking_value: 7800, booked_at: day(3), age: 9, assigned_to: ADMIN_ID }),
    ],
    landing_lead_activities: [
      { id: 1, created_at: day(0.1), lead_id: "00000000-0000-4000-8000-000000000001", actor_label: "système", type: "created", from_status: null, to_status: null, body: "Formulaire /omra — consentement v2026-11-v1" },
    ],
    landing_events: [
      // clics WhatsApp enregistrés (visiteurs ayant accepté les traceurs) : permettent de retrouver l'origine d'un message reçu
      { id: 1, created_at: day(1), event_name: "Contact", event_id: "evt-seed-0001", visitor_ref: "E2B-SEED22", product: "omra", offer: null, niche: "omra-ramadan-2027", location: "hero", channel: "meta", utm_source: "instagram", utm_campaign: "bio", utm_content: null, ad_id: null },
      { id: 2, created_at: day(2), event_name: "Contact", event_id: "evt-seed-0002", visitor_ref: "E2B-SEED33", product: "voyage", offer: null, niche: null, location: "header", channel: "tiktok", utm_source: "tiktok", utm_campaign: "ugc-2", utm_content: null, ad_id: null },
    ],
    landing_categories: [
      { id: "cccccccc-0000-4000-8000-000000000001", slug: "omra-2027", name: "عمرة رمضان وشوال 2027", product: "omra", lang: "ar", headline: "3 أفواج", description: null, banner_desktop: null, banner_mobile: null, seo_title: null, seo_description: null, visible: true, position: 0, updated_at: day(1) },
      { id: "cccccccc-0000-4000-8000-000000000002", slug: "turquie-ete", name: "Turquie été 2027", product: "voyage", lang: "fr", headline: "Istanbul, Cappadoce, Antalya", description: null, banner_desktop: null, banner_mobile: null, seo_title: null, seo_description: null, visible: false, position: 1, updated_at: day(1) },
    ],
    landing_offers: [
      { id: "aaaaaaaa-0000-4000-8000-000000000001", category_id: "cccccccc-0000-4000-8000-000000000001", product: "omra", name: "الفوج الأول", sku: "OMRA-2701", tag: "✈️ أول فوج", destination: null, departure_date: "2027-01-27", nights: 14, nights_detail: "10 بمكة + 4 بالمدينة", price: 5500, price_before: null, cost: 4700, seats_total: 40, seats_sold: 22, features: ["طيران", "تأشيرة"], description: null, image_url: null, visible: true, position: 1, archived_at: null, updated_at: day(1) },
      { id: "aaaaaaaa-0000-4000-8000-000000000002", category_id: "cccccccc-0000-4000-8000-000000000001", product: "omra", name: "الفوج الثاني", sku: "OMRA-1802", tag: "⭐ الإقامة الأطول", destination: null, departure_date: "2027-02-18", nights: 25, nights_detail: "20 بمكة + 5 بالمدينة", price: 7800, price_before: 8500, cost: 6600, seats_total: 30, seats_sold: 24, features: ["طيران", "تأشيرة"], description: null, image_url: null, visible: true, position: 2, archived_at: null, updated_at: day(1) },
      { id: "aaaaaaaa-0000-4000-8000-000000000003", category_id: "cccccccc-0000-4000-8000-000000000001", product: "omra", name: "عمرة شوال", sku: "OMRA-1503", tag: "🕌 السعر الأقل", destination: null, departure_date: "2027-03-15", nights: 14, nights_detail: "10 بمكة + 4 بالمدينة", price: 4800, price_before: null, cost: 4100, seats_total: null, seats_sold: 0, features: [], description: null, image_url: null, visible: true, position: 3, archived_at: null, updated_at: day(1) },
    ],
    landing_promo_codes: [
      { id: 1, code: "RAMADAN27", title: "Remise Ramadan", discount_type: "percent", discount_value: 10, product: "omra", starts_on: null, ends_on: null, max_uses: 50, used_count: 7, active: true, created_at: day(3) },
      { id: 2, code: "ETE50", title: "Été -50 TND", discount_type: "amount", discount_value: 50, product: null, starts_on: null, ends_on: "2026-01-01", max_uses: null, used_count: 12, active: true, created_at: day(30) },
    ],
    landing_blocklist: [{ id: 1, kind: "phone", value: "21600000000", reason: "faux lead", active: true, created_at: day(2), updated_at: day(2), actor_label: ADMIN.email }],
    landing_protection: [{ id: 1, allowed_countries: [] }],
    landing_integrations: [],
    landing_integration_changes: [],
    landing_admin_log: [],
    landing_message_templates: [
      { id: "dddddddd-0000-4000-8000-000000000001", title: "Premier contact (Omra)", body: "السلام عليكم {prenom} 🌙 وصلنا طلبك ({ref}) بخصوص {offre}.", product: "omra", position: 1, active: true },
      { id: "dddddddd-0000-4000-8000-000000000002", title: "Relance", body: "Bonjour {prenom}, nous revenons vers vous au sujet de {offre} ({ref}).", product: null, position: 2, active: true },
    ],
    landing_campaign_performance: [],
    landing_niche_performance: [
      { product: "omra", niche: "omra-ramadan-2027", clics_whatsapp: 41, visiteurs_contact: 33, leads: 9, reservations: 2, chiffre_affaires_tnd: 23400 },
    ],
  }
  const postsWithoutOrg = [] // insertions envoyées PAR LE SITE sans organization_id (mode tenant) : doit rester vide
  if (tenant) {
    db.organizations = [{ id: E2B_ORG, slug: "easy2book", name: "Easy2Book", status: "active" }]
    for (const t of TENANT_TABLES) for (const r of db[t] ?? []) r.organization_id = E2B_ORG
    // vues statistiques : depuis 0010 elles exposent organization_id
    for (const v of ["landing_campaign_performance", "landing_niche_performance"]) for (const r of db[v] ?? []) r.organization_id = E2B_ORG
  }
  if (multi) {
    db.organizations.push({ id: BOB_ORG, slug: "bob-sarl", name: "Bob SARL", status: "active" })
    users.push({ id: BOB.id, email: BOB.email, password: BOB.password })
    db.organization_members = [
      { organization_id: E2B_ORG, user_id: ADMIN_ID, role: "admin", active: true },
      { organization_id: E2B_ORG, user_id: AGENT_ID, role: "employee", active: true },
      { organization_id: BOB_ORG, user_id: BOB.id, role: "admin", active: true },
    ]
    db.landing_niche_performance.push({ product: "voyage", niche: "voyage-bob-ete", clics_whatsapp: 5, visiteurs_contact: 4, leads: 3, reservations: 1, chiffre_affaires_tnd: 4200, organization_id: BOB_ORG })
    db.landing_staff.push({ user_id: BOB.id, email: BOB.email, full_name: "Bob Directeur", role: "admin", active: true, created_at: day(30), organization_id: BOB_ORG })
    const bobLeads = [
      lead(901, { first_name: "Zied", last_name: "Bobclient", phone: "21690000901", product: "voyage", offer: "Circuit Bob 1", age: 1 }),
      lead(902, { first_name: "Yosra", last_name: "Bobprospect", phone: "21690000902", product: "voyage", offer: "Circuit Bob 2", status: "contacte", age: 2 }),
      lead(903, { first_name: "Walid", last_name: "Bobvente", phone: "21690000903", product: "hotel", offer: "Séjour Bob", status: "reserve", booking_value: 4200, booked_at: day(1), age: 3 }),
    ]
    for (const l of bobLeads) db.landing_leads.push({ ...l, organization_id: BOB_ORG, ref: `E2B-B${l.ref.slice(5)}`.slice(0, 10) })
  }
  const seq = { landing_lead_activities: 100, landing_promo_codes: 100, landing_blocklist: 100, landing_integration_changes: 100, landing_admin_log: 100 }
  // valeurs par défaut posées par la vraie base (DEFAULT des migrations)
  const DEFAULTS = {
    landing_promo_codes: { active: true, used_count: 0 },
    landing_blocklist: { active: true },
    landing_message_templates: { active: true, position: 0 },
    landing_offers: { visible: false, position: 0, seats_sold: 0, features: [], archived_at: null },
    landing_categories: { visible: false, position: 0, lang: "fr" },
  }
  const UNIQUE = { landing_leads: ["ref", "idempotency_key"], landing_promo_codes: ["code"], landing_staff: ["email"], landing_offers: ["sku"], landing_categories: ["slug"] }

  const match = (row, params) => {
    for (const [k, raw] of params) {
      if (["select", "order", "limit", "offset", "on_conflict"].includes(k) || k === "or") continue
      const m = /^(not\.)?(eq|neq|is|in|gte|lte|gt|lt|like|ilike)\.(.*)$/.exec(raw)
      if (!m) continue
      const [, not, op, val] = m
      const cell = row[k]
      let ok = true
      if (op === "eq") ok = String(cell) === val
      else if (op === "neq") ok = String(cell) !== val
      else if (op === "is") ok = val === "null" ? cell === null || cell === undefined : String(cell) === val
      else if (op === "in") ok = val.replace(/^\(|\)$/g, "").split(",").includes(String(cell))
      else if (["gte", "lte", "gt", "lt"].includes(op)) {
        const a = Date.parse(cell), b = Date.parse(val)
        const x = Number.isNaN(a) || Number.isNaN(b) ? String(cell) : a, y = Number.isNaN(a) || Number.isNaN(b) ? val : b
        ok = cell != null && (op === "gte" ? x >= y : op === "lte" ? x <= y : op === "gt" ? x > y : x < y)
      } else if (op === "like" || op === "ilike") ok = String(cell ?? "").toLowerCase().includes(val.replace(/\*/g, "").toLowerCase())
      if (not && op === "is") ok = !ok
      else if (not) ok = !ok
      if (!ok) return false
    }
    return true
  }
  const project = (rows, select) => {
    if (!select || select === "*") return rows
    const cols = select.split(",")
    return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])))
  }

  async function body(req) {
    const chunks = []
    for await (const c of req) chunks.push(c)
    return Buffer.concat(chunks)
  }
  const send = (res, status, json) => {
    res.writeHead(status, { "Content-Type": "application/json" })
    res.end(json === undefined ? "" : JSON.stringify(json))
  }
  const bearer = (req) => (req.headers.authorization || "").replace(/^Bearer /, "")

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x")
    const p = url.pathname
    const buf = await body(req)
    const text = buf.toString("utf8")
    let json = {}
    try {
      json = text && (req.headers["content-type"] || "").includes("json") ? JSON.parse(text) : {}
    } catch {}
    calls.push(`${req.method} ${p}${url.search}`)

    // ---------------- Auth
    if (p === "/auth/v1/token") {
      const grant = url.searchParams.get("grant_type")
      let user
      if (grant === "password") user = users.find((u) => u.email === json.email && u.password === json.password)
      else user = users.find((u) => u.id === refresh.get(json.refresh_token))
      if (!user) return send(res, 400, { error: "invalid_grant" })
      const at = jwt(), rt = `rt-${randomUUID()}`
      sessions.set(at, user.id)
      refresh.set(rt, user.id)
      return send(res, 200, { access_token: at, refresh_token: rt, expires_in: 3600, user: { id: user.id, email: user.email } })
    }
    if (p === "/auth/v1/user") {
      const user = users.find((u) => u.id === sessions.get(bearer(req)))
      if (!user) return send(res, 401, { msg: "invalid" })
      if (req.method === "PUT") {
        if (String(json.password || "").length < 10) return send(res, 422, { msg: "weak" })
        user.password = json.password
      }
      return send(res, 200, { id: user.id, email: user.email })
    }
    if (p === "/auth/v1/logout") return send(res, 204)
    if (p === "/auth/v1/admin/users" && req.method === "POST") {
      if (users.some((u) => u.email === json.email)) return send(res, 422, { msg: "exists" })
      const u = { id: randomUUID(), email: json.email, password: json.password }
      users.push(u)
      return send(res, 200, { id: u.id, email: u.email })
    }
    if (p === "/auth/v1/admin/users" && req.method === "GET") return send(res, 200, { users: users.map((u) => ({ id: u.id, email: u.email })) })
    const adminUser = /^\/auth\/v1\/admin\/users\/([0-9a-f-]+)$/.exec(p)
    if (adminUser && req.method === "PUT") {
      const u = users.find((x) => x.id === adminUser[1])
      if (!u) return send(res, 404, {})
      u.password = json.password ?? u.password
      return send(res, 200, { id: u.id })
    }

    // ---------------- Storage
    if (p.startsWith("/storage/v1/object/landing-media/") && req.method === "POST") return send(res, 200, { Key: p })

    // ---------------- REST
    const rpc = /^\/rest\/v1\/rpc\/(\w+)$/.exec(p)
    if (rpc) {
      if (rpc[1] === "landing_redeem_promo") {
        const promo = db.landing_promo_codes.find((c) => c.code === String(json.p_code).toUpperCase() && c.active && (!tenant || c.organization_id === json.p_org))
        if (!promo) return send(res, 200, [])
        promo.used_count++
        return send(res, 200, [{ code: promo.code }])
      }
      return send(res, 200, [])
    }
    const t = /^\/rest\/v1\/(\w+)$/.exec(p)
    if (!t || !db[t[1]]) return send(res, 404, { code: "PGRST205", message: "table inconnue" })
    const name = t[1]
    const rows = db[name]
    const params = [...url.searchParams.entries()]
    const prefer = String(req.headers.prefer || "")

    if (req.method === "GET") {
      let out = rows.filter((r) => match(r, params))
      const order = url.searchParams.get("order")
      if (order) {
        const [col, dir] = order.split(",")[0].split(".")
        out = [...out].sort((a, b) => (String(a[col] ?? "") < String(b[col] ?? "") ? -1 : String(a[col] ?? "") > String(b[col] ?? "") ? 1 : 0) * (dir === "desc" ? -1 : 1))
      }
      const off = parseInt(url.searchParams.get("offset") || "0", 10)
      const lim = parseInt(url.searchParams.get("limit") || "1000", 10)
      return send(res, 200, project(out.slice(off, off + lim), url.searchParams.get("select")))
    }
    if (req.method === "POST") {
      const row = { ...json }
      const conflict = url.searchParams.get("on_conflict")
      if (conflict) {
        const keys = conflict.split(",")
        const ex = rows.find((r) => keys.every((k) => r[k] === row[k]))
        if (ex) Object.assign(ex, row)
        else rows.push({ id: ++seq[name] ?? randomUUID(), created_at: day(0), ...row })
        return send(res, 201)
      }
      const GLOBAL_COLS = new Set(["ref", "email"]) // restent uniques sur toute la base (0010/0011)
      for (const col of UNIQUE[name] ?? []) {
        const sameScope = (r) => GLOBAL_COLS.has(col) || !tenant || r.organization_id === row.organization_id
        if (row[col] != null && rows.some((r) => r[col] === row[col] && sameScope(r))) return send(res, 409, { code: "23505" })
      }
      const base = name === "landing_leads" || name === "landing_offers" || name === "landing_categories" || name === "landing_message_templates" ? { id: randomUUID() } : { id: (seq[name] = (seq[name] ?? 0) + 1) }
      if (tenant && TENANT_TABLES.includes(name) && row.organization_id === undefined) postsWithoutOrg.push(name)
      const created = { ...base, created_at: day(0), updated_at: day(0), ...(tenant && TENANT_TABLES.includes(name) ? { organization_id: E2B_ORG } : {}), ...(name === "landing_leads" ? { lead_day: day(0).slice(0, 10), status: "nouveau" } : {}), ...(DEFAULTS[name] ?? {}), ...row }
      rows.push(created)
      return prefer.includes("return=minimal") ? send(res, 201) : send(res, 201, [created])
    }
    if (req.method === "PATCH") {
      const hit = rows.filter((r) => match(r, params))
      hit.forEach((r) => Object.assign(r, json))
      return send(res, 200, hit)
    }
    return send(res, 405, {})
  })

  return {
    server,
    db,
    calls,
    tenant,
    multi,
    BOB_ORG,
    BOB,
    postsWithoutOrg,
    E2B_ORG,
    TENANT_TABLES,
    users,
    listen: (port) => new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server))),
    close: () => new Promise((ok) => server.close(ok)),
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const f = createFakeSupabase()
  const port = Number(process.argv[2] || 54321)
  await f.listen(port)
  console.log(`faux Supabase sur http://127.0.0.1:${port} — ${ADMIN.email} / ${ADMIN.password}`)
}
