import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0013 sur PostgreSQL (PGlite) : rôle manager dans l'équipe.
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const M = (n: string) => read(`migrations/${n}`)
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql", "0008_multitenant_foundation.sql", "0009_employees_see_org_leads.sql", "0010_per_org_uniqueness_expand.sql", "0011_per_org_uniqueness_contract.sql", "0012_platform_organizations.sql"].map(M).join("\n")
const M13 = M("0013_manager_role.sql")
const R13 = read("rollback/0013_rollback.sql")
const POST13 = read("scripts/postcheck-0013.sql")
const STUB = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz DEFAULT now(), banned_until timestamptz, created_at timestamptz DEFAULT now(), last_sign_in_at timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`
const E2B = "00000000-0000-4000-8000-0000000e2b01"
const U = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`
let db: PGlite
const exec = (s: string) => db.exec(s)
const staff = (id: string, role: string) => db.query("INSERT INTO landing_staff (user_id, email, role, active, organization_id) VALUES ($1,$2,$3,true,$4)", [id, `${id.slice(-1)}@x.tn`, role, E2B])
const memberRole = async (id: string) => (await db.query<{ role: string }>("SELECT role FROM organization_members WHERE user_id = $1", [id])).rows[0]?.role

beforeEach(async () => {
  db = new PGlite()
  await exec(STUB + BEFORE)
  await exec(`INSERT INTO auth.users (id, email) VALUES ('${U(1)}','a@x.tn'),('${U(2)}','b@x.tn'),('${U(3)}','c@x.tn')`)
})

describe("0013 : rôle manager", () => {
  it("avant : le rôle manager est refusé ; garde-fous (EasyV4, 0008, double exécution)", async () => {
    await expect(staff(U(1), "manager")).rejects.toThrow(/check|contrainte|constraint/i)
    await exec(M13)
    await expect(exec(M13)).rejects.toThrow(/déjà/)
    const other = new PGlite(); await other.exec(STUB + BEFORE + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M13)).rejects.toThrow(/EasyV4/)
  })
  it("après : admin / manager / agent → admin / manager / employee ; un rôle inconnu reste refusé", async () => {
    await exec(M13)
    await staff(U(1), "admin"); await staff(U(2), "manager"); await staff(U(3), "agent")
    expect([await memberRole(U(1)), await memberRole(U(2)), await memberRole(U(3))]).toEqual(["admin", "manager", "employee"])
    await expect(staff("aaaaaaaa-0000-4000-8000-000000000009", "root")).rejects.toThrow()
  })
  it("un changement de rôle est répercuté dans les deux sens (manager ↔ agent)", async () => {
    await exec(M13)
    await staff(U(1), "admin"); await staff(U(2), "agent")
    await db.query("UPDATE landing_staff SET role='manager' WHERE user_id=$1", [U(2)])
    expect(await memberRole(U(2))).toBe("manager")
    await db.query("UPDATE landing_staff SET role='agent' WHERE user_id=$1", [U(2)])
    expect(await memberRole(U(2))).toBe("employee")
  })
  it("il reste toujours un administrateur : un manager ne remplace pas le dernier admin", async () => {
    await exec(M13)
    await staff(U(1), "admin")
    await expect(db.query("UPDATE landing_staff SET role='manager' WHERE user_id=$1", [U(1)])).rejects.toThrow()
  })
  it("un manager voit les leads de son entreprise (RLS) mais n'écrit rien", async () => {
    await exec(M13)
    await staff(U(1), "admin"); await staff(U(2), "manager")
    await exec(`INSERT INTO landing_leads (ref, idempotency_key, first_name, phone, product, contact_consent, organization_id) VALUES ('E2B-AAAAAA','evt-00000001','A','21611111111','omra',true,'${E2B}')`)
    await exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${U(2)}',false)`)
    expect((await db.query("SELECT 1 FROM landing_leads")).rows).toHaveLength(1)
    await expect(exec("UPDATE landing_leads SET first_name='X'")).rejects.toThrow()
    await exec("RESET ROLE")
  })
  it("postcheck : 2 OK après, À CORRIGER avant ; retour arrière refusé avec un manager, sinon propre", async () => {
    const before = (await db.query<{ resultat: string }>(POST13)).rows
    expect(before.every((r) => r.resultat === "À CORRIGER")).toBe(true)
    await exec(M13)
    expect((await db.query<{ resultat: string }>(POST13)).rows.every((r) => r.resultat === "OK")).toBe(true)
    await staff(U(1), "admin"); await staff(U(2), "manager")
    await expect(exec(R13)).rejects.toThrow(/manager/)
    await exec("ROLLBACK").catch(() => undefined)
    await db.query("UPDATE landing_staff SET role='agent' WHERE user_id=$1", [U(2)])
    await exec(R13)
    await expect(staff(U(3), "manager")).rejects.toThrow()
  })
  it("sabotage : sans la traduction manager → manager, le test de recopie échoue", async () => {
    const broken = M13.replace("WHEN 'manager' THEN 'manager' ", "")
    expect(broken).not.toBe(M13)
    const d = new PGlite(); await d.exec(STUB + BEFORE + broken)
    await d.exec(`INSERT INTO auth.users (id, email) VALUES ('${U(1)}','a@x.tn'),('${U(2)}','b@x.tn')`)
    await d.query("INSERT INTO landing_staff (user_id,email,role,active,organization_id) VALUES ($1,'a@x.tn','admin',true,$3),($2,'b@x.tn','manager',true,$3)", [U(1), U(2), E2B])
    expect((await d.query<{ role: string }>("SELECT role FROM organization_members WHERE user_id=$1", [U(2)])).rows[0].role).toBe("employee") // le défaut que le vrai test interdit
  })
})
