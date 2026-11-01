import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { renderTemplate, validateTemplate } from "@/lib/server/templates"
import { addMember, tempPassword, updateMember } from "@/lib/server/team"
import { listLeads, findDuplicates, type LeadRow } from "@/lib/server/crm"
import { loadDashboard } from "@/lib/server/dashboard"
import { configureAll, installFetchMock, DB_URL } from "./helpers"

const read = (f: string) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8")
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql"].map(read).join("\n")
const M5 = read("0005_landing_team_templates.sql")
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
const A = "11111111-1111-1111-1111-111111111111"
const B = "22222222-2222-2222-2222-222222222222"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("migration 0005_landing_team_templates.sql", () => {
  let db: PGlite
  beforeEach(async () => {
    db = new PGlite()
    await db.exec(STUB)
  })

  it("exige 0004, refuse une seconde exécution, crée les modèles", async () => {
    await expect(db.exec(M5)).rejects.toThrow(/0004/)
    await db.exec(BEFORE)
    await db.exec(M5)
    await expect(db.exec(M5)).rejects.toThrow(/déjà/)
    expect((await db.query("SELECT id FROM landing_message_templates WHERE active")).rows.length).toBe(4)
  })

  it("il reste toujours un administrateur actif ; journal en ajout seul ; aucun accès API", async () => {
    await db.exec(BEFORE + M5)
    await db.exec(`INSERT INTO auth.users VALUES ('${A}'), ('${B}');
      INSERT INTO landing_staff (user_id, email, role) VALUES ('${A}', 'direction@easy2book.tn', 'admin'), ('${B}', 'agent@easy2book.tn', 'agent');`)
    await db.exec("SET ROLE service_role")
    await expect(db.query(`UPDATE landing_staff SET active = false WHERE user_id = '${A}'`)).rejects.toThrow(/au moins un administrateur/)
    await expect(db.query(`UPDATE landing_staff SET role = 'agent' WHERE user_id = '${A}'`)).rejects.toThrow(/au moins un administrateur/)
    await db.query(`UPDATE landing_staff SET role = 'admin' WHERE user_id = '${B}'`)
    await db.query(`UPDATE landing_staff SET active = false WHERE user_id = '${A}'`) // un autre admin reste
    await expect(db.query(`DELETE FROM landing_staff WHERE user_id = '${B}'`)).rejects.toThrow(/permission denied/)
    await db.query(`INSERT INTO landing_admin_log (actor_label, area, summary) VALUES ('x', 'equipe', 'test')`)
    await expect(db.query("UPDATE landing_admin_log SET summary = 'y'")).rejects.toThrow(/permission denied|ajout seul/)
    await db.exec("RESET ROLE")
    await expect(db.query("DELETE FROM landing_admin_log")).rejects.toThrow(/ajout seul/)
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`)
      await expect(db.query("SELECT * FROM landing_message_templates")).rejects.toThrow(/permission denied/)
      await expect(db.query("SELECT * FROM landing_admin_log")).rejects.toThrow(/permission denied/)
      await db.exec("RESET ROLE")
    }
  })
})

describe("modèles WhatsApp", () => {
  it("remplace les variables (offre absente → nom du produit)", () => {
    const lead = { first_name: "Ahmed", last_name: "Ben Ali", ref: "E2B-ABC234", offer: null, product: "omra" as const }
    expect(renderTemplate("السلام عليكم {prenom} ({ref}) — {offre} / {produit} {inconnu}", lead)).toBe("السلام عليكم Ahmed (E2B-ABC234) — Omra / Omra {inconnu}")
    expect(validateTemplate({ title: "x", body: "" }).errors).toMatchObject({ title: expect.any(String), body: expect.any(String) })
  })
})

describe("équipe", () => {
  it("mot de passe provisoire : 14 caractères sans ambiguïté", () => {
    const p = tempPassword()
    expect(p).toHaveLength(14)
    expect(p).not.toMatch(/[0O1lI]/)
  })

  it("ajout : compte Auth créé (clé serveur), ligne d'équipe, journal ; mot de passe renvoyé une seule fois", async () => {
    configureAll()
    const f = installFetchMock()
    const orig = globalThis.fetch
    const authCalls: { url: string; body: unknown }[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
      const u = String(url)
      if (u.includes("/auth/v1/admin/users")) {
        authCalls.push({ url: u, body: init.body ? JSON.parse(String(init.body)) : null })
        return new Response(JSON.stringify({ id: B }), { status: 200 })
      }
      return orig(url as string, init)
    }))
    const res = await addMember({ email: " Agent@Easy2Book.tn ", fullName: "Agent B", role: "agent" }, { id: A, label: "direction@easy2book.tn" })
    expect(res).toMatchObject({ ok: true, email: "agent@easy2book.tn" })
    expect(res.ok && res.password).toHaveLength(14)
    expect(authCalls[0].body).toMatchObject({ email: "agent@easy2book.tn", email_confirm: true })
    expect(f.db.landing_staff[0]).toMatchObject({ user_id: B, email: "agent@easy2book.tn", role: "agent", active: true })
    expect(f.db.landing_admin_log[0].summary).toContain("agent@easy2book.tn")
    expect(JSON.stringify(f.db.landing_admin_log)).not.toContain(res.ok ? res.password! : "x")
    expect((await addMember({ email: "pas-un-email", fullName: "", role: "agent" }, { id: A, label: "x" })).ok).toBe(false)
  })

  it("un administrateur ne peut pas retirer ses propres droits", async () => {
    configureAll()
    installFetchMock()
    expect(await updateMember(A, { active: false }, { id: A, label: "x" })).toMatchObject({ ok: false })
    expect(await updateMember(A, { role: "agent" }, { id: A, label: "x" })).toMatchObject({ ok: false })
  })
})

describe("liste, tableau de bord et doublons", () => {
  it("filtres « mes leads », « non assignés », « ouverts », « relances » traduits en filtres sûrs", async () => {
    configureAll()
    const f = installFetchMock()
    await listLeads({ assigned: "me", me: A, open: "1" })
    await listLeads({ assigned: "none" })
    await listLeads({ assigned: "drop table" })
    await listLeads({ followUp: "due" })
    const urls = f.dbCalls().map((c) => decodeURIComponent(c.url))
    expect(urls[0]).toContain(`assigned_to=eq.${A}`)
    expect(urls[0]).toContain("status=in.(nouveau,contacte,qualifie)")
    expect(urls[1]).toContain("assigned_to=is.null")
    expect(urls[2]).not.toContain("drop")
    expect(urls[3]).toContain("next_follow_up_at=lte.")
    expect(urls[3]).toContain("status=in.(nouveau,contacte,qualifie)")
  })

  it("tableau de bord : à traiter, relances échues, mes dossiers, non assignés, réservés du mois", async () => {
    configureAll()
    const past = new Date(Date.now() - 3600_000).toISOString()
    vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
      const u = decodeURIComponent(String(url))
      if (u.includes("status=in.(nouveau,contacte,qualifie)"))
        return new Response(JSON.stringify([
          { status: "nouveau", next_follow_up_at: null, assigned_to: null },
          { status: "contacte", next_follow_up_at: past, assigned_to: A },
          { status: "qualifie", next_follow_up_at: null, assigned_to: B },
        ]))
      if (u.includes("status=eq.reserve")) return new Response(JSON.stringify([{ booking_value: "11000" }, { booking_value: 5500 }]))
      return new Response(JSON.stringify([{ id: "1" }, { id: "2" }]))
    }))
    expect(await loadDashboard(A)).toEqual({ toTreat: 1, today: 2, overdue: 1, mine: 1, unassigned: 1, bookedMonth: 2, revenueMonth: 16500 })
  })

  it("doublons : même téléphone, autre fiche ; numéro invalide → aucune requête", async () => {
    configureAll()
    const f = installFetchMock()
    await findDuplicates({ id: "33333333-3333-3333-3333-333333333333", phone: "21698140514" } as LeadRow)
    expect(decodeURIComponent(f.dbCalls()[0].url)).toContain(`${DB_URL}/rest/v1/landing_leads?select=id,ref,product,status,created_at,offer&phone=eq.21698140514&id=neq.`)
    expect(await findDuplicates({ id: "x", phone: "abc" } as LeadRow)).toEqual([])
  })
})
