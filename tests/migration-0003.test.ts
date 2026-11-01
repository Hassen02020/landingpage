import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 + 0002 + 0003 sur PostgreSQL (PGlite), rôles et privilèges par défaut simulés comme sur Supabase.
const read = (f: string) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8")
const [M1, M2, M3] = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql"].map(read)
const SUPABASE_STUB = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;`
const STAFF = "11111111-1111-1111-1111-111111111111"

let db: PGlite
async function as<T>(role: "authenticated" | "anon" | "service_role", fn: () => Promise<T>): Promise<T> {
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${STAFF}', false); SET ROLE ${role};`)
  try {
    return await fn()
  } finally {
    await db.exec("RESET ROLE")
  }
}

beforeEach(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
})

describe("migration 0003_landing_admin.sql", () => {
  it("exige 0001 + 0002, refuse une seconde exécution et une base EasyV4", async () => {
    await expect(db.exec(M3)).rejects.toThrow(/0002/)
    await db.exec(M1)
    await db.exec(M2)
    await db.exec(M3)
    await expect(db.exec(M3)).rejects.toThrow(/déjà/)

    const other = new PGlite()
    await other.exec(SUPABASE_STUB + M1 + M2 + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M3)).rejects.toThrow(/EasyV4/)
  })

  describe("après application", () => {
    beforeEach(async () => {
      await db.exec(M1 + M2 + M3)
      await db.exec(`INSERT INTO auth.users VALUES ('${STAFF}'); INSERT INTO landing_staff (user_id, email, role) VALUES ('${STAFF}', 'direction@easy2book.tn', 'admin');`)
    })

    it("aucun accès par l'API pour anon et les comptes connectés (même admin) : jetons, blocages, promos", async () => {
      for (const role of ["anon", "authenticated"] as const) {
        for (const t of ["landing_integrations", "landing_integration_changes", "landing_blocklist", "landing_protection", "landing_promo_codes"]) {
          await expect(as(role, () => db.query(`SELECT * FROM ${t}`))).rejects.toThrow(/permission denied/)
        }
        await expect(as(role, () => db.query("SELECT * FROM landing_redeem_promo('X', 'omra')"))).rejects.toThrow(/permission denied/)
      }
    })

    it("service_role : droits minimaux (pas de DELETE ni TRUNCATE), journal en ajout seul", async () => {
      await as("service_role", async () => {
        await db.query("INSERT INTO landing_integrations (provider, enabled, pixel_id, token_ciphertext, token_last4) VALUES ('meta', true, '1674012850599992', 'v1:aaa:bbb:ccc', 'ab12')")
        await db.query("UPDATE landing_integrations SET enabled = false WHERE provider = 'meta'")
        await expect(db.query("DELETE FROM landing_integrations")).rejects.toThrow(/permission denied/)
        await expect(db.query("TRUNCATE landing_integrations")).rejects.toThrow(/permission denied/)
        await db.query(`INSERT INTO landing_integration_changes (provider, actor_id, actor_label, summary) VALUES ('meta', '${STAFF}', 'direction@easy2book.tn', 'jeton remplacé')`)
        await expect(db.query("UPDATE landing_integration_changes SET summary = 'x'")).rejects.toThrow(/permission denied|ajout seul/)
        await expect(db.query("DELETE FROM landing_blocklist")).rejects.toThrow(/permission denied/)
        await expect(db.query("DELETE FROM landing_promo_codes")).rejects.toThrow(/permission denied/)
        await expect(db.query("INSERT INTO landing_protection (id) VALUES (1)")).rejects.toThrow(/permission denied/)
      })
      // même le propriétaire ne peut pas réécrire le journal
      await expect(db.query("UPDATE landing_integration_changes SET summary = 'x'")).rejects.toThrow(/ajout seul/)
      await expect(db.query("TRUNCATE landing_integration_changes")).rejects.toThrow(/ajout seul/)
    })

    it("refuse un jeton en clair (format chiffré obligatoire) et un jeton sans ses 4 derniers caractères", async () => {
      await expect(db.query("INSERT INTO landing_integrations (provider, token_ciphertext, token_last4) VALUES ('meta', 'EAAB123 clair', 'clai')")).rejects.toThrow(/check/i)
      await expect(db.query("INSERT INTO landing_integrations (provider, token_ciphertext) VALUES ('meta', 'v1:a:b:c')")).rejects.toThrow(/check/i)
      await expect(db.query("INSERT INTO landing_integrations (provider) VALUES ('google')")).rejects.toThrow(/check/i)
    })

    it("codes promo : utilisation atomique, limites, dates, produit, désactivation", async () => {
      await db.exec(`INSERT INTO landing_promo_codes (code, title, discount_type, discount_value, product, max_uses) VALUES
        ('RAMADAN27', 'Remise Ramadan', 'percent', 10, 'omra', 2),
        ('OLD', 'Ancien', 'amount', 50, NULL, NULL),
        ('OFF', 'Coupé', 'amount', 50, NULL, NULL);
        UPDATE landing_promo_codes SET ends_on = current_date - 1 WHERE code = 'OLD';
        UPDATE landing_promo_codes SET active = false WHERE code = 'OFF';`)
      const redeem = (code: string, product = "omra") =>
        as("service_role", async () => (await db.query(`SELECT * FROM landing_redeem_promo($1, $2)`, [code, product])).rows.length)
      expect(await redeem("ramadan27")).toBe(1) // insensible à la casse
      expect(await redeem("RAMADAN27", "voyage")).toBe(0) // autre produit
      expect(await redeem("RAMADAN27")).toBe(1)
      expect(await redeem("RAMADAN27")).toBe(0) // limite atteinte
      expect(await redeem("OLD")).toBe(0) // expiré
      expect(await redeem("OFF")).toBe(0) // désactivé
      expect((await db.query<{ used_count: number }>("SELECT used_count FROM landing_promo_codes WHERE code = 'RAMADAN27'")).rows[0].used_count).toBe(2)
      await expect(db.query("INSERT INTO landing_promo_codes (code, title, discount_type, discount_value) VALUES ('BAD', 'x y', 'percent', 150)")).rejects.toThrow(/check/i)
      await expect(db.query("INSERT INTO landing_promo_codes (code, title, discount_type, discount_value) VALUES ('a b', 'titre', 'amount', 5)")).rejects.toThrow(/check/i)
    })

    it("le code promo s'enregistre sur le lead ; protection : une seule ligne de réglages", async () => {
      await as("service_role", () =>
        db.query("INSERT INTO landing_leads (ref, idempotency_key, first_name, phone, product, contact_consent, promo_code) VALUES ('E2B-ABC234', 'evt-00000001', 'A', '21698140514', 'omra', true, 'RAMADAN27')")
      )
      expect((await db.query<{ promo_code: string }>("SELECT promo_code FROM landing_leads")).rows[0].promo_code).toBe("RAMADAN27")
      await as("service_role", async () => {
        await db.query("UPDATE landing_protection SET allowed_countries = '{TN,FR}' WHERE id = 1")
        await db.query("INSERT INTO landing_blocklist (kind, value) VALUES ('phone', '21698140514')")
        await expect(db.query("INSERT INTO landing_blocklist (kind, value) VALUES ('phone', '21698140514')")).rejects.toThrow(/duplicate|unique/i)
      })
      await expect(db.query("INSERT INTO landing_protection (id) VALUES (2)")).rejects.toThrow(/check/i)
      await expect(db.query("INSERT INTO landing_blocklist (kind, value) VALUES ('email', 'x@y.tn')")).rejects.toThrow(/check/i)
    })
  })
})
