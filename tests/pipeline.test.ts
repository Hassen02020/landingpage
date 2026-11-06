import { afterEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { BOOKING_STATUSES, NEXT_STAGE, OPEN_STATUSES, STATUSES, STATUS_LABELS, UNTREATED_STATUSES, inFilter, isBooking, isOpen, parseStatusList } from "@/lib/status"
import { changeStatus, listLeads, type LeadRow } from "@/lib/server/crm"
import { rates, teamStats, totals, type LeadStatRow } from "@/lib/server/stats"
import { configureAll, installFetchMock, post } from "./helpers"
import { POST as statusPOST } from "@/app/api/leads/status/route"

const actor = { id: "11111111-1111-4111-8111-111111111111", label: "agent@easy2book.tn" }
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("pipeline commercial : définition unique des statuts", () => {
  it("les 5 statuts historiques gardent EXACTEMENT leur valeur (compatibilité) ; 10 statuts dans l'ordre du pipeline", () => {
    for (const legacy of ["nouveau", "contacte", "qualifie", "reserve", "perdu"]) expect(STATUSES).toContain(legacy)
    expect(STATUSES).toEqual(["nouveau", "a_contacter", "contacte", "a_qualifier", "qualifie", "devis", "negociation", "reserve", "gagne", "perdu"])
    for (const s of STATUSES) expect(STATUS_LABELS[s]).toBeTruthy()
    expect(STATUS_LABELS.devis).toBe("Devis / proposition")
  })

  it("ouverts / vendus / non traités : sous-ensembles cohérents, sans recouvrement", () => {
    expect([...OPEN_STATUSES, ...BOOKING_STATUSES, "perdu"].sort()).toEqual([...STATUSES].sort())
    expect(OPEN_STATUSES.some((s) => isBooking(s))).toBe(false)
    expect(UNTREATED_STATUSES.every((s) => isOpen(s))).toBe(true)
    expect(isBooking("reserve") && isBooking("gagne") && !isBooking("devis") && !isOpen("perdu")).toBe(true)
  })

  it("la chaîne « étape suivante » mène de NOUVEAU à GAGNÉ sans boucle, et PERDU peut être rouvert", () => {
    const path = ["nouveau"]
    while (NEXT_STAGE[path.at(-1) as (typeof STATUSES)[number]]) path.push(NEXT_STAGE[path.at(-1) as (typeof STATUSES)[number]]!)
    expect(path).toEqual(["nouveau", "a_contacter", "contacte", "a_qualifier", "qualifie", "devis", "negociation", "reserve", "gagne"])
    expect(NEXT_STAGE.perdu).toBe("contacte")
  })

  it("filtres de liste : liste de statuts validée (aucune valeur libre n'atteint la requête)", () => {
    expect(parseStatusList("nouveau, a_contacter ,nouveau,hack;drop,perdu")).toEqual(["nouveau", "a_contacter", "perdu"])
    expect(parseStatusList(undefined)).toEqual([])
    expect(inFilter(["reserve", "gagne"])).toBe("in.(reserve,gagne)")
  })

  it("listLeads : statut unique = eq, liste = in, valeurs invalides ignorées, « ouverts » couvre les 7 étapes", async () => {
    configureAll()
    const f = installFetchMock()
    await listLeads({ status: "devis" })
    await listLeads({ status: "reserve,gagne" })
    await listLeads({ status: "x,y" })
    await listLeads({ open: "1" })
    await listLeads({ followUp: "due" })
    const u = f.dbCalls().map((c) => decodeURIComponent(c.url))
    expect(u[0]).toContain("status=eq.devis")
    expect(u[1]).toContain("status=in.(reserve,gagne)")
    expect(u[2]).not.toContain("status=")
    expect(u[3]).toContain("status=in.(nouveau,a_contacter,contacte,a_qualifier,qualifie,devis,negociation)")
    expect(u[4]).toContain("status=in.(nouveau,a_contacter,contacte,a_qualifier,qualifie,devis,negociation)")
  })
})

describe("statuts : la vente est comptée UNE fois, la conversion publicitaire envoyée UNE fois", () => {
  const baseLead = () => ({ id: "00000000-0000-4000-8000-000000000001", ref: "E2B-ABC234", first_name: "Ahmed", phone: "21698140514", product: "omra", offer: "الفوج الثاني", status: "nouveau", booking_value: null, booked_at: null, tracking_consent: true, anonymized_at: null, visitor_id: "v1", ip: "1.2.3.4", user_agent: "ua" })

  it("parcours complet nouveau → … → devis → négociation → réservé → gagné : un seul Purchase", async () => {
    configureAll()
    const f = installFetchMock()
    f.db.landing_leads = [baseLead()]
    const row = () => f.db.landing_leads[0] // ligne en base (modifiée par le faux)
    const current = () => ({ ...row() }) as LeadRow // fiche lue : une COPIE, comme en production
    const results: (string | null)[] = []
    for (const [status, value] of [["a_contacter"], ["contacte"], ["a_qualifier"], ["qualifie"], ["devis"], ["negociation"], ["reserve", 15600], ["gagne"]] as [Parameters<typeof changeStatus>[1], number?][]) {
      const r = await changeStatus(current(), status, actor, value === undefined ? {} : { bookingValue: value })
      expect(r.ok).toBe(true)
      results.push(r.ok ? r.conversion : null)
      expect(row().status).toBe(status)
    }
    expect(results.filter((c) => c === "envoyée")).toHaveLength(1) // à l'étape « reserve » seulement
    expect(results.at(-1)).toBeNull() // réservé → gagné : aucune seconde conversion
    expect(f.meta()).toHaveLength(1)
    expect(f.tiktok()).toHaveLength(1)
    expect(Number(row().booking_value)).toBe(15600)
    expect(row().booked_at).toBeTruthy()
    // historique : chaque transition est tracée avec son avant / après
    const trail = f.db.landing_lead_activities.filter((a) => a.type === "status_change").map((a) => `${a.from_status}>${a.to_status}`)
    expect(trail).toEqual(["nouveau>a_contacter", "a_contacter>contacte", "contacte>a_qualifier", "a_qualifier>qualifie", "qualifie>devis", "devis>negociation", "negociation>reserve", "reserve>gagne"])
  })

  it("retour en arrière puis nouvelle réservation : la vente n'est PAS renvoyée (date de réservation posée une fois)", async () => {
    configureAll()
    const f = installFetchMock()
    f.db.landing_leads = [baseLead()]
    const row = () => f.db.landing_leads[0]
    const current = () => ({ ...row() }) as LeadRow
    await changeStatus(current(), "reserve", actor, { bookingValue: 5500 })
    const bookedAt = row().booked_at
    await changeStatus(current(), "negociation", actor)
    const again = await changeStatus(current(), "gagne", actor)
    expect(again).toMatchObject({ ok: true, conversion: null })
    expect(row().booked_at).toBe(bookedAt)
    expect(f.meta()).toHaveLength(1)
  })

  it("« gagné » sans montant refusé (comme « réservé ») ; devis / négociation n'exigent aucun montant ; saut direct vers gagné = 1re vente", async () => {
    configureAll()
    const f = installFetchMock()
    f.db.landing_leads = [baseLead()]
    const row = () => f.db.landing_leads[0]
    const current = () => ({ ...row() }) as LeadRow
    expect(await changeStatus(current(), "gagne", actor)).toMatchObject({ ok: false, error: expect.stringContaining("Montant") })
    expect(await changeStatus(current(), "reserve", actor)).toMatchObject({ ok: false })
    expect((await changeStatus(current(), "devis", actor)).ok).toBe(true)
    expect(await changeStatus(current(), "gagne", actor, { bookingValue: 7800 })).toMatchObject({ ok: true, conversion: "envoyée" })
    expect(f.meta()).toHaveLength(1)
  })

  it("visiteur sans consentement aux traceurs : vente enregistrée, aucune conversion envoyée", async () => {
    configureAll()
    const f = installFetchMock()
    f.db.landing_leads = [{ ...baseLead(), tracking_consent: false }]
    expect(await changeStatus({ ...f.db.landing_leads[0] } as LeadRow, "gagne", actor, { bookingValue: 1000 })).toMatchObject({ ok: true, conversion: "sans consentement" })
    expect(f.meta()).toHaveLength(0)
  })

  it("API de statut (clé admin) : montant exigé pour gagné, nouveaux statuts acceptés", async () => {
    configureAll()
    const f = installFetchMock()
    f.db.landing_leads = [baseLead()]
    const headers = { "x-api-key": "k".repeat(40) }
    const noAmount = await statusPOST(post("/api/leads/status", { id: baseLead().id, status: "gagne" }, headers))
    expect(noAmount.status).toBe(400)
    expect((await statusPOST(post("/api/leads/status", { id: baseLead().id, status: "devis" }, headers))).status).toBe(200)
    expect((await statusPOST(post("/api/leads/status", { id: baseLead().id, status: "gagne", booking_value: 7800 }, headers))).status).toBe(200)
    expect((await statusPOST(post("/api/leads/status", { id: baseLead().id, status: "inconnu" }, headers))).status).toBe(400)
  })
})

describe("statistiques avec le pipeline à 10 statuts", () => {
  const L = (status: LeadStatRow["status"], booking_value: number | null = null, assigned_to: string | null = null): LeadStatRow => ({ status, booking_value, channel: "meta", utm_campaign: "c", utm_term: null, utm_content: null, campaign_id: null, adset_id: null, ad_id: null, assigned_to })
  const rows = [L("nouveau"), L("a_contacter"), L("contacte"), L("a_qualifier"), L("qualifie"), L("devis"), L("negociation"), L("reserve", 11000), L("gagne", 5500), L("perdu")]

  it("regroupements : à traiter, en contact, qualifiés, devis / négociation, vendus (réservé + gagné), perdus", () => {
    const c = totals(rows)
    expect(c).toMatchObject({ leads: 10, toTreat: 2, inContact: 2, qualified: 1, proposal: 2, booked: 2, lost: 1, revenue: 16500 })
    expect(c.reserve + c.gagne).toBe(c.booked)
  })

  it("taux : traités = hors « à traiter » ; vente = réservé + gagné ; conclusion = ventes / (ventes + perdus)", () => {
    const r = rates(totals(rows))
    expect(r.treated).toBe(8)
    expect(r.bookingRate).toBe(0.2)
    expect(r.closingRate).toBeCloseTo(2 / 3)
    expect(r.avgBasket).toBe(8250)
  })

  it("réservé → gagné ne compte qu'UNE vente par conseiller ; devis envoyés comptés", () => {
    const staff = [{ user_id: "u1", email: "a@e.tn", full_name: "Agent A", role: "agent" as const, active: true }]
    const acts = [
      { actor_id: "u1", type: "status_change", from_status: "qualifie" as const, to_status: "devis" as const },
      { actor_id: "u1", type: "status_change", from_status: "negociation" as const, to_status: "reserve" as const },
      { actor_id: "u1", type: "status_change", from_status: "reserve" as const, to_status: "gagne" as const },
      { actor_id: "u1", type: "status_change", from_status: "contacte" as const, to_status: "gagne" as const }, // saut direct : une 2e vente
      { actor_id: "u1", type: "status_change", from_status: "devis" as const, to_status: "perdu" as const },
    ]
    expect(teamStats(staff, acts, [])[0]).toMatchObject({ proposals: 1, booked: 2, lost: 1, closingRate: 2 / 3 })
  })
})

describe("migration 0007_landing_pipeline.sql", () => {
  const read = (f: string) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8")
  const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql"].map(read).join("\n")
  const M7 = read("0007_landing_pipeline.sql")
  const STUB = `
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`
  let n = 0
  const lead = (db: PGlite, o: Record<string, unknown> = {}) => {
    n++
    const row = { ref: `E2B-T${String(10000 + n)}`.slice(0, 10), idempotency_key: `evt-${String(10000000 + n)}`, first_name: "A", phone: `2162200${String(1000 + n)}`, product: "omra", contact_consent: true, ...o }
    const k = Object.keys(row)
    return db.query<{ id: string }>(`INSERT INTO landing_leads (${k}) VALUES (${k.map((_, i) => `$${i + 1}`)}) RETURNING id`, Object.values(row))
  }

  it("exige 0006, refuse une seconde exécution et une base EasyV4", async () => {
    const db = new PGlite()
    await db.exec(STUB)
    await expect(db.exec(M7)).rejects.toThrow(/0006/)
    await db.exec(BEFORE)
    await db.exec(M7)
    await expect(db.exec(M7)).rejects.toThrow(/déjà/)
    const other = new PGlite()
    await other.exec(STUB + BEFORE + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M7)).rejects.toThrow(/EasyV4/)
  })

  it("compatibilité : un lead existant (réservé, perdu…) n'est pas modifié par la migration", async () => {
    const db = new PGlite()
    await db.exec(STUB + BEFORE)
    await lead(db, { status: "reserve", booked_at: new Date().toISOString(), booking_value: 4800 })
    await lead(db, { status: "perdu" })
    await lead(db, { status: "qualifie" })
    await db.exec(M7)
    const r = (await db.query<{ status: string; n: number }>("SELECT status, count(*) AS n FROM landing_leads GROUP BY 1 ORDER BY 1")).rows
    expect(r).toEqual([{ status: "perdu", n: 1 }, { status: "qualifie", n: 1 }, { status: "reserve", n: 1 }])
  })

  describe("après application", () => {
    it("accepte les 10 statuts (leads et historique), refuse un statut inconnu ; une vente a toujours sa date de réservation", async () => {
      const db = new PGlite()
      await db.exec(STUB + BEFORE + M7)
      for (const s of STATUSES) {
        const booked = s === "reserve" || s === "gagne" ? { booked_at: new Date().toISOString(), booking_value: 100 } : {}
        const { rows } = await lead(db, { status: s, ...booked })
        await db.query("INSERT INTO landing_lead_activities (lead_id, actor_label, type, from_status, to_status) VALUES ($1, 'x', 'status_change', 'nouveau', $2)", [rows[0].id, s])
      }
      await expect(lead(db, { status: "archive" })).rejects.toThrow(/check/i)
      await expect(lead(db, { status: "gagne" })).rejects.toThrow(/check/i) // gagné sans booked_at
      await expect(lead(db, { status: "reserve" })).rejects.toThrow(/check/i) // règle historique conservée
    })

    it("vues d'analyse : vendu = réservé + gagné, la vente n'est comptée qu'une fois ; traités = hors nouveau / à contacter", async () => {
      const db = new PGlite()
      await db.exec(STUB + BEFORE + M7)
      const booked = { booked_at: new Date().toISOString() }
      await lead(db, { status: "reserve", booking_value: 11000, channel: "meta", utm_campaign: "c1", ...booked })
      await lead(db, { status: "gagne", booking_value: 5500, channel: "meta", utm_campaign: "c1", ...booked })
      for (const s of ["nouveau", "a_contacter", "contacte", "devis"]) await lead(db, { status: s, channel: "meta", utm_campaign: "c1" })
      const v = (await db.query<{ leads: number; leads_traites: number; reservations: number; chiffre_affaires_tnd: number | string }>("SELECT leads, leads_traites, reservations, chiffre_affaires_tnd FROM landing_campaign_performance")).rows[0]
      expect({ ...v, chiffre_affaires_tnd: Number(v.chiffre_affaires_tnd) }).toEqual({ leads: 6, leads_traites: 4, reservations: 2, chiffre_affaires_tnd: 16500 })
    })

    it("CONSERVATION : un lead GAGNÉ est gardé 36 mois comme un lead réservé (pas anonymisé à 24 mois)", async () => {
      const db = new PGlite()
      await db.exec(STUB + BEFORE + M7)
      const old = (months: number) => `now() - interval '${months} months'`
      const mk = async (status: string, months: number, ref: string) => {
        const booked = status === "reserve" || status === "gagne" ? { booked_at: new Date(Date.now() - months * 30 * 864e5).toISOString(), booking_value: 100 } : {}
        const { rows } = await lead(db, { status, ref, ...booked })
        await db.exec(`UPDATE landing_leads SET created_at = ${old(months)}, last_activity_at = ${old(months)} WHERE id = '${rows[0].id}'`)
      }
      await mk("gagne", 25, "E2B-GAG250")
      await mk("reserve", 25, "E2B-RES250")
      await mk("gagne", 40, "E2B-GAG400")
      await mk("devis", 25, "E2B-DEV250")
      await mk("perdu", 25, "E2B-PER250")
      await db.exec("SET ROLE service_role")
      await db.query("SELECT public.landing_purge_personal_data()")
      await db.exec("RESET ROLE")
      const rows = (await db.query<{ ref: string; anonymized_at: Date | null }>("SELECT ref, anonymized_at FROM landing_leads")).rows
      const anon = Object.fromEntries(rows.map((r) => [r.ref, r.anonymized_at !== null]))
      expect(anon).toEqual({ "E2B-GAG250": false, "E2B-RES250": false, "E2B-GAG400": true, "E2B-DEV250": true, "E2B-PER250": true })
    })
  })
})
