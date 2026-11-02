import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { REGIONS } from "@/lib/regions"

// 0001 → 0006 sur PostgreSQL (PGlite), privilèges par défaut Supabase simulés.
const read = (f: string) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8")
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql"].map(read).join("\n")
const M6 = read("0006_landing_qualification.sql")
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

let db: PGlite
beforeEach(async () => {
  db = new PGlite()
  await db.exec(STUB)
})
const lead = (o: Record<string, unknown> = {}) => {
  const row = { ref: "E2B-ABC234", idempotency_key: "evt-00000001", first_name: "Ahmed", phone: "21698140514", product: "omra", contact_consent: true, ...o }
  const k = Object.keys(row)
  return db.query<{ id: string }>(`INSERT INTO landing_leads (${k}) VALUES (${k.map((_, i) => `$${i + 1}`)}) RETURNING id`, Object.values(row))
}

describe("migration 0006_landing_qualification.sql", () => {
  it("exige 0005, refuse une seconde exécution et une base EasyV4", async () => {
    await expect(db.exec(M6)).rejects.toThrow(/0005/)
    await db.exec(BEFORE)
    await db.exec(M6)
    await expect(db.exec(M6)).rejects.toThrow(/déjà/)
    const other = new PGlite()
    await other.exec(STUB + BEFORE + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M6)).rejects.toThrow(/EasyV4/)
  })

  it("la liste des régions du code est identique à la contrainte SQL", () => {
    for (const r of REGIONS) expect(M6).toContain(`'${r.replace(/'/g, "''")}'`)
    expect(M6.match(/CHECK \(region IN \(([^)]+)\)/)![1].split(",").length).toBe(REGIONS.length)
  })

  describe("après application", () => {
    beforeEach(async () => {
      await db.exec(BEFORE + "\n" + M6)
    })

    it("un lead du premier contact (prénom + téléphone + produit) : voyageurs inconnus, canal WhatsApp, e-mail et région vides", async () => {
      await lead()
      const r = (await db.query<{ adults: number | null; children: number | null; email: string | null; region: string | null; contact_channel: string }>("SELECT adults, children, email, region, contact_channel FROM landing_leads")).rows[0]
      expect(r).toEqual({ adults: null, children: null, email: null, region: null, contact_channel: "whatsapp" })
    })

    it("form_page : chemin de la page du formulaire (255 caractères max), vide par défaut", async () => {
      await lead({ form_page: "/omra" })
      await expect(lead({ ref: "E2B-LONG23", idempotency_key: "evt-00000020", phone: "21622000020", form_page: "/" + "a".repeat(260) })).rejects.toThrow(/check/i)
      expect((await db.query<{ form_page: string | null }>("SELECT form_page FROM landing_leads")).rows[0].form_page).toBe("/omra")
    })

    it("valide l'e-mail (facultatif), la région, le canal et les bornes de voyageurs", async () => {
      await lead({ email: "client@example.tn", region: "Sousse", adults: 2, children: 1, contact_channel: "phone" })
      await expect(lead({ ref: "E2B-BAD234", idempotency_key: "evt-00000002", phone: "21622000001", email: "pas un email" })).rejects.toThrow(/check/i)
      await expect(lead({ ref: "E2B-BAD235", idempotency_key: "evt-00000003", phone: "21622000002", region: "Atlantide" })).rejects.toThrow(/check/i)
      await expect(lead({ ref: "E2B-BAD236", idempotency_key: "evt-00000004", phone: "21622000003", contact_channel: "pigeon" })).rejects.toThrow(/check/i)
      await expect(lead({ ref: "E2B-BAD237", idempotency_key: "evt-00000005", phone: "21622000004", adults: 0 })).rejects.toThrow(/check/i)
    })

    it("service_role peut qualifier (UPDATE) mais pas supprimer ; aucun accès anon", async () => {
      const { rows } = await lead()
      await db.exec("SET ROLE service_role")
      await db.query(`UPDATE landing_leads SET region = 'Tunis', email = 'a@b.tn', budget = '5000 TND' WHERE id = '${rows[0].id}'`)
      await expect(db.query("DELETE FROM landing_leads")).rejects.toThrow(/permission denied/)
      await db.exec("RESET ROLE; SET ROLE anon")
      await expect(db.query("SELECT email FROM landing_leads")).rejects.toThrow(/permission denied/)
      await db.exec("RESET ROLE")
    })

    it("conservation : l'e-mail et la région sont effacés à l'anonymisation, pas avant", async () => {
      const old = await lead({ ref: "E2B-OLD234", idempotency_key: "evt-00000010", phone: "21622000010", email: "ancien@example.tn", region: "Sfax", status: "perdu" })
      const recent = await lead({ ref: "E2B-NEW234", idempotency_key: "evt-00000011", phone: "21622000011", email: "recent@example.tn", region: "Tunis" })
      await db.exec(`UPDATE landing_leads SET created_at = now() - interval '25 months', last_activity_at = now() - interval '25 months' WHERE id = '${old.rows[0].id}'`)
      await db.exec("SET ROLE service_role")
      await db.query("SELECT public.landing_purge_personal_data()")
      await db.exec("RESET ROLE")
      const rows = (await db.query<{ ref: string; email: string | null; region: string | null; phone: string | null; anonymized_at: Date | null }>("SELECT ref, email, region, phone, anonymized_at FROM landing_leads ORDER BY ref")).rows
      expect(rows.find((r) => r.ref === "E2B-OLD234")).toMatchObject({ email: null, region: null, phone: null })
      expect(rows.find((r) => r.ref === "E2B-OLD234")!.anonymized_at).not.toBeNull()
      expect(rows.find((r) => r.ref === "E2B-NEW234")).toMatchObject({ email: "recent@example.tn", region: "Tunis", anonymized_at: null })
      void recent
    })
  })
})
