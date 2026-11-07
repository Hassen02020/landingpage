import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

// 0001 → 0008 sur PostgreSQL (PGlite), privilèges par défaut Supabase simulés.
// Les politiques RLS sont testées avec de VRAIS changements de rôle (authenticated / anon) et de jeton (auth.uid()).
const read = (f: string) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8")
const M = (n: string) => read(`migrations/${n}`)
const BEFORE = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql", "0004_landing_catalog.sql", "0005_landing_team_templates.sql", "0006_landing_qualification.sql", "0007_landing_pipeline.sql"].map(M).join("\n")
const M8 = M("0008_multitenant_foundation.sql")
const ROLLBACK = read("rollback/0008_rollback.sql")
const PROVISION = read("scripts/provision-super-admin.sql")
const STUB = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`

const E2B = "00000000-0000-4000-8000-0000000e2b01"
const u = (n: number) => `00000000-0000-4000-8000-00000000000${n}`
const [OWNER, AGENT, ALICE_ADMIN, ALICE_MGR, ALICE_EMP, BOB_ADMIN, BOB_EMP, OUTSIDER, SUPER] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(u)

let db: PGlite
let n = 0

async function leadRow(o: Record<string, unknown> = {}) {
  n++
  const row = { ref: `E2B-ABC${String(n).padStart(3, "0")}`.replace(/0/g, "2"), idempotency_key: `evt-${String(n).padStart(8, "0")}`, first_name: "Ahmed", phone: `2169814${String(n).padStart(4, "0")}`, product: "omra", contact_consent: true, ...o }
  const k = Object.keys(row)
  return (await db.query<{ id: string }>(`INSERT INTO landing_leads (${k}) VALUES (${k.map((_, i) => `$${i + 1}`)}) RETURNING id`, Object.values(row))).rows[0].id
}

/** Exécute `sql` comme un compte connecté (rôle authenticated + jeton). */
async function asUser<T = any>(sub: string | null, sql: string): Promise<T[]> {
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${sub ?? ""}', false); SET ROLE authenticated`)
  try {
    return (await db.query<T>(sql)).rows
  } finally {
    await db.exec("RESET ROLE")
  }
}
async function asAnon(sql: string) {
  await db.exec("SET ROLE anon")
  try {
    return (await db.query(sql)).rows
  } finally {
    await db.exec("RESET ROLE")
  }
}

beforeEach(async () => {
  n = 0
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(BEFORE)
})

describe("migration 0008 : garde-fous et application", () => {
  it("exige 0007, refuse une seconde exécution et une base EasyV4", async () => {
    const early = new PGlite()
    await early.exec(STUB)
    await expect(early.exec(M8)).rejects.toThrow(/0007|0001 à 0007/)
    await db.exec(M8)
    await expect(db.exec(M8)).rejects.toThrow(/déjà/)
    const other = new PGlite()
    await other.exec(STUB + BEFORE + "CREATE TABLE public.agencies (id int);")
    await expect(other.exec(M8)).rejects.toThrow(/EasyV4/)
  })
})

describe("rattachement des données historiques à Easy2Book", () => {
  it("leads, historique, événements, équipe et configuration existants reçoivent l'organisation Easy2Book ; équipe recopiée en membres", async () => {
    await db.exec(`INSERT INTO auth.users VALUES ('${OWNER}', 'owner@e2b.tn'), ('${AGENT}', 'agent@e2b.tn')`)
    await db.exec(`INSERT INTO landing_staff (user_id, email, role) VALUES ('${OWNER}', 'owner@e2b.tn', 'admin'), ('${AGENT}', 'agent@e2b.tn', 'agent')`)
    const l1 = await leadRow()
    await leadRow({ assigned_to: AGENT })
    await db.query("INSERT INTO landing_lead_activities (lead_id, actor_label, type) VALUES ($1, 'api', 'created'), ($1, 'agent', 'note')", [l1]) // historique réel AVANT la migration
    await db.exec(`INSERT INTO landing_events (event_name, event_id, product) VALUES ('Contact', 'ev-00000001', 'omra')`)
    const before = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_leads")).rows[0].n
    const actBefore = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_lead_activities")).rows[0].n

    await db.exec(M8)

    const tables = ["landing_leads", "landing_events", "landing_lead_activities", "landing_staff", "landing_integrations", "landing_integration_changes", "landing_admin_log", "landing_protection", "landing_blocklist", "landing_categories", "landing_offers", "landing_promo_codes", "landing_message_templates"]
    for (const t of tables) {
      const r = (await db.query<{ total: number; e2b: number }>(`SELECT count(*)::int AS total, count(*) FILTER (WHERE organization_id = '${E2B}')::int AS e2b FROM ${t}`)).rows[0]
      expect(r.e2b, `${t} : toutes les lignes existantes sont rattachées à Easy2Book`).toBe(r.total)
      if (["landing_leads", "landing_events", "landing_lead_activities", "landing_staff"].includes(t)) expect(r.total, `${t} : le test porte sur des lignes réelles`).toBeGreaterThan(0)
    }
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_leads")).rows[0].n).toBe(before) // aucune ligne perdue
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_lead_activities")).rows[0].n).toBe(actBefore) // historique intact
    const org = (await db.query<{ slug: string; status: string }>("SELECT slug, status FROM organizations")).rows
    expect(org).toEqual([{ slug: "easy2book", status: "active" }])
    const members = (await db.query<{ user_id: string; role: string; active: boolean }>("SELECT user_id, role, active FROM organization_members ORDER BY role")).rows
    expect(members).toEqual([
      { user_id: OWNER, role: "admin", active: true },
      { user_id: AGENT, role: "employee", active: true },
    ])
    expect(l1).toBeTruthy()
  })

  it("non-régression : le code actuel (service_role, sans organization_id) continue d'écrire ; tout va à Easy2Book", async () => {
    await db.exec(M8)
    await db.exec(`INSERT INTO auth.users VALUES ('${AGENT}', 'agent@e2b.tn')`)
    await db.exec("SET ROLE service_role")
    await db.query(`INSERT INTO landing_staff (user_id, email, role) VALUES ('${AGENT}', 'agent@e2b.tn', 'agent')`).catch(() => {}) // service_role n'écrit pas l'équipe : géré en SQL
    const id = await leadRow()
    await db.query("UPDATE landing_leads SET status = 'contacte' WHERE id = $1", [id])
    await db.query("INSERT INTO landing_lead_activities (lead_id, actor_label, type) VALUES ($1, 'api', 'created')", [id])
    await db.exec("RESET ROLE")
    const lead = (await db.query<{ organization_id: string; status: string }>("SELECT organization_id, status FROM landing_leads WHERE id = $1", [id])).rows[0]
    expect(lead).toEqual({ organization_id: E2B, status: "contacte" })
    const act = (await db.query<{ organization_id: string }>("SELECT organization_id FROM landing_lead_activities WHERE lead_id = $1", [id])).rows[0]
    expect(act.organization_id).toBe(E2B)
  })

  it("l'historique hérite TOUJOURS de l'organisation de son lead, même si on essaie d'en imposer une autre", async () => {
    await db.exec(M8)
    await db.exec(`INSERT INTO organizations (id, slug, name) VALUES ('${u(2)}', 'bob', 'Bob SARL')`)
    const id = await leadRow()
    await db.query("INSERT INTO landing_lead_activities (lead_id, actor_label, type, organization_id) VALUES ($1, 'api', 'created', $2)", [id, u(2)])
    const act = (await db.query<{ organization_id: string }>("SELECT organization_id FROM landing_lead_activities WHERE lead_id = $1", [id])).rows[0]
    expect(act.organization_id).toBe(E2B)
  })
})

describe("isolation entre deux entreprises (RLS, rôles réels)", () => {
  let aliceOrg: string, bobOrg: string
  let aliceLead1: string, aliceLead2: string, bobLead: string

  beforeEach(async () => {
    await db.exec(M8)
    aliceOrg = u(1) // « Alice SARL »
    bobOrg = u(2)
    await db.exec(`INSERT INTO organizations (id, slug, name) VALUES ('${aliceOrg}', 'alice', 'Alice SARL'), ('${bobOrg}', 'bob', 'Bob SARL')`)
    for (const [id, email] of [[ALICE_ADMIN, "aa@a.tn"], [ALICE_MGR, "am@a.tn"], [ALICE_EMP, "ae@a.tn"], [BOB_ADMIN, "ba@b.tn"], [BOB_EMP, "be@b.tn"], [OUTSIDER, "x@x.tn"], [SUPER, "super@e2b.tn"]])
      await db.exec(`INSERT INTO auth.users VALUES ('${id}', '${email}')`)
    // équipes (landing_staff est la table de l'application ; les membres sont tenus par la synchronisation + insertion directe)
    await db.exec(`
      INSERT INTO landing_staff (user_id, email, role, organization_id) VALUES
        ('${ALICE_EMP}', 'ae@a.tn', 'agent', '${aliceOrg}'), ('${BOB_EMP}', 'be@b.tn', 'agent', '${bobOrg}');
      INSERT INTO organization_members (organization_id, user_id, role) VALUES
        ('${aliceOrg}', '${ALICE_ADMIN}', 'admin'), ('${aliceOrg}', '${ALICE_MGR}', 'manager'),
        ('${bobOrg}', '${BOB_ADMIN}', 'admin');
      INSERT INTO platform_admins (user_id) VALUES ('${SUPER}');`)
    aliceLead1 = await leadRow({ organization_id: aliceOrg, assigned_to: ALICE_EMP })
    aliceLead2 = await leadRow({ organization_id: aliceOrg }) // non affecté
    bobLead = await leadRow({ organization_id: bobOrg, assigned_to: BOB_EMP })
    for (const id of [aliceLead1, aliceLead2, bobLead]) await db.query("INSERT INTO landing_lead_activities (lead_id, actor_label, type) VALUES ($1, 'api', 'note')", [id])
    await db.exec(`INSERT INTO landing_events (event_name, event_id, product, organization_id) VALUES ('Contact', 'ev-a0000001', 'omra', '${aliceOrg}'), ('Contact', 'ev-b0000001', 'omra', '${bobOrg}')`)
  })

  const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort()

  it("l'administrateur de l'entreprise A voit les leads de A et AUCUN lead de B", async () => {
    const rows = await asUser<{ id: string; organization_id: string }>(ALICE_ADMIN, "SELECT id, organization_id FROM landing_leads")
    expect(ids(rows)).toEqual([aliceLead1, aliceLead2].sort())
    expect(rows.every((r) => r.organization_id === aliceOrg)).toBe(true)
    expect(await asUser(ALICE_ADMIN, `SELECT id FROM landing_leads WHERE id = '${bobLead}'`)).toEqual([]) // accès direct à un lead de B
  })

  it("symétrique : l'administrateur de B ne voit que B", async () => {
    expect(ids(await asUser(BOB_ADMIN, "SELECT id FROM landing_leads"))).toEqual([bobLead])
  })

  it("le manager de A voit tous les leads de A ; l'employé de A voit SEULEMENT ceux qui lui sont attribués", async () => {
    expect(ids(await asUser(ALICE_MGR, "SELECT id FROM landing_leads"))).toEqual([aliceLead1, aliceLead2].sort())
    expect(ids(await asUser(ALICE_EMP, "SELECT id FROM landing_leads"))).toEqual([aliceLead1])
    expect(await asUser(ALICE_EMP, `SELECT id FROM landing_leads WHERE id IN ('${aliceLead2}', '${bobLead}')`)).toEqual([])
  })

  it("l'historique suit la même visibilité (employé : ses leads ; admin : son organisation ; jamais l'autre)", async () => {
    const adminRows = await asUser<{ lead_id: string }>(ALICE_ADMIN, "SELECT lead_id FROM landing_lead_activities")
    expect(adminRows.map((r) => r.lead_id).sort()).toEqual([aliceLead1, aliceLead2].sort())
    expect((await asUser<{ lead_id: string }>(ALICE_EMP, "SELECT lead_id FROM landing_lead_activities")).map((r) => r.lead_id)).toEqual([aliceLead1])
    expect(await asUser(ALICE_ADMIN, `SELECT 1 FROM landing_lead_activities WHERE lead_id = '${bobLead}'`)).toEqual([])
  })

  it("événements de navigation : admin / manager de l'organisation seulement, jamais un employé ni l'autre entreprise", async () => {
    const own = await asUser<{ organization_id: string }>(ALICE_ADMIN, "SELECT organization_id FROM landing_events")
    expect(own).toEqual([{ organization_id: aliceOrg }]) // exactement l'événement de A, pas celui de B
    expect(await asUser<{ organization_id: string }>(BOB_ADMIN, "SELECT organization_id FROM landing_events")).toEqual([{ organization_id: bobOrg }])
    expect(await asUser(ALICE_EMP, "SELECT 1 FROM landing_events")).toEqual([])
  })

  it("un compte connecté qui n'appartient à AUCUNE organisation ne voit rien ; un anonyme est refusé", async () => {
    expect(await asUser(OUTSIDER, "SELECT 1 FROM landing_leads")).toEqual([])
    expect(await asUser(OUTSIDER, "SELECT 1 FROM organizations")).toEqual([])
    expect(await asUser(OUTSIDER, "SELECT 1 FROM organization_members")).toEqual([])
    expect(await asUser(null, "SELECT 1 FROM landing_leads")).toEqual([])
    await expect(asAnon("SELECT 1 FROM landing_leads")).rejects.toThrow(/permission denied/)
    await expect(asAnon("SELECT 1 FROM organizations")).rejects.toThrow(/permission denied/)
  })

  it("chaque compte ne lit que SON organisation et les membres de la sienne", async () => {
    expect((await asUser<{ slug: string }>(ALICE_ADMIN, "SELECT slug FROM organizations")).map((r) => r.slug)).toEqual(["alice"])
    expect((await asUser<{ slug: string }>(BOB_EMP, "SELECT slug FROM organizations")).map((r) => r.slug)).toEqual(["bob"])
    const aliceMembers = (await asUser<{ user_id: string }>(ALICE_ADMIN, "SELECT user_id FROM organization_members")).map((r) => r.user_id).sort()
    expect(aliceMembers).toEqual([ALICE_ADMIN, ALICE_MGR, ALICE_EMP].sort())
    // un employé ne voit que sa propre ligne de membre
    expect((await asUser<{ user_id: string }>(ALICE_EMP, "SELECT user_id FROM organization_members")).map((r) => r.user_id)).toEqual([ALICE_EMP])
    // l'équipe (landing_staff) : l'administrateur de A ne voit pas celle de B
    const staff = (await asUser<{ user_id: string }>(ALICE_ADMIN, "SELECT user_id FROM landing_staff")).map((r) => r.user_id)
    expect(staff).toEqual([ALICE_EMP])
  })

  it("Super Admin : voit toutes les organisations et tous les membres, mais PAS les leads ni les événements", async () => {
    expect((await asUser<{ slug: string }>(SUPER, "SELECT slug FROM organizations ORDER BY slug")).map((r) => r.slug)).toEqual(["alice", "bob", "easy2book"])
    expect((await asUser(SUPER, "SELECT 1 FROM organization_members")).length).toBeGreaterThanOrEqual(5)
    expect(await asUser(SUPER, "SELECT 1 FROM landing_leads")).toEqual([])
    expect(await asUser(SUPER, "SELECT 1 FROM landing_lead_activities")).toEqual([])
    expect(await asUser(SUPER, "SELECT 1 FROM landing_events")).toEqual([])
  })

  it("un compte ne peut ni s'accorder le rôle Super Admin, ni se promouvoir, ni écrire dans les organisations (aucun droit d'écriture par l'API)", async () => {
    await expect(asUser(ALICE_ADMIN, `INSERT INTO platform_admins (user_id) VALUES ('${ALICE_ADMIN}')`)).rejects.toThrow(/permission denied/)
    await expect(asUser(ALICE_EMP, `UPDATE organization_members SET role = 'admin' WHERE user_id = '${ALICE_EMP}'`)).rejects.toThrow(/permission denied/)
    await expect(asUser(ALICE_ADMIN, `INSERT INTO organization_members (organization_id, user_id, role) VALUES ('${bobOrg}', '${ALICE_ADMIN}', 'admin')`)).rejects.toThrow(/permission denied/)
    await expect(asUser(ALICE_ADMIN, `UPDATE organizations SET status = 'suspended' WHERE id = '${aliceOrg}'`)).rejects.toThrow(/permission denied/)
    await expect(asUser(ALICE_ADMIN, `UPDATE landing_leads SET organization_id = '${bobOrg}' WHERE id = '${aliceLead1}'`)).rejects.toThrow(/permission denied/)
    expect(await asUser(ALICE_ADMIN, "SELECT 1 FROM platform_admins")).toEqual([]) // la table des Super Admin n'est lisible que par soi-même
    expect((await asUser(SUPER, "SELECT user_id FROM platform_admins")).length).toBe(1)
  })

  it("service_role : peut lire, mais ne peut NI créer d'administrateur plateforme, NI modifier les membres (privilège minimal)", async () => {
    await db.exec("SET ROLE service_role")
    try {
      expect((await db.query("SELECT 1 FROM organizations")).rows.length).toBe(3)
      await expect(db.query(`INSERT INTO platform_admins (user_id) VALUES ('${ALICE_ADMIN}')`)).rejects.toThrow(/permission denied/)
      await expect(db.query(`UPDATE organization_members SET role = 'admin' WHERE user_id = '${ALICE_EMP}'`)).rejects.toThrow(/permission denied/)
      await expect(db.query("DELETE FROM organizations")).rejects.toThrow(/permission denied/)
    } finally {
      await db.exec("RESET ROLE")
    }
  })

  it("une organisation SUSPENDUE n'a plus aucun accès (lecture et visibilité) ; la réactivation le rétablit", async () => {
    await db.exec(`UPDATE organizations SET status = 'suspended' WHERE id = '${aliceOrg}'`)
    expect(await asUser(ALICE_ADMIN, "SELECT 1 FROM landing_leads")).toEqual([])
    expect(await asUser(ALICE_EMP, "SELECT 1 FROM landing_leads")).toEqual([])
    expect(ids(await asUser(BOB_ADMIN, "SELECT id FROM landing_leads"))).toEqual([bobLead]) // les autres ne sont pas touchées
    await db.exec(`UPDATE organizations SET status = 'active' WHERE id = '${aliceOrg}'`)
    expect((await asUser(ALICE_ADMIN, "SELECT 1 FROM landing_leads")).length).toBe(2)
  })

  it("un membre désactivé perd l'accès immédiatement", async () => {
    await db.exec(`UPDATE organization_members SET active = false WHERE user_id = '${ALICE_MGR}'`)
    expect(await asUser(ALICE_MGR, "SELECT 1 FROM landing_leads")).toEqual([])
  })

  it("un lead ne peut pas être confié à un conseiller d'une autre entreprise, ni changer d'organisation", async () => {
    await expect(db.query("UPDATE landing_leads SET assigned_to = $1 WHERE id = $2", [BOB_EMP, aliceLead2])).rejects.toThrow(/n'appartient pas à l'organisation/)
    await expect(db.query("UPDATE landing_leads SET organization_id = $1 WHERE id = $2", [bobOrg, aliceLead1])).rejects.toThrow(/immuable/)
    await db.exec(`SET landing.org_move = 'on'`) // seul le propriétaire (SQL) peut déplacer volontairement
    await db.exec("UPDATE landing_leads SET assigned_to = NULL WHERE id = '" + aliceLead1 + "'")
    await db.query("UPDATE landing_leads SET organization_id = $1 WHERE id = $2", [bobOrg, aliceLead1])
    await db.exec("RESET landing.org_move")
  })

  it("une organisation garde toujours un administrateur actif", async () => {
    await expect(db.exec(`UPDATE organization_members SET active = false WHERE user_id = '${BOB_ADMIN}'`)).rejects.toThrow(/au moins un administrateur/)
    await expect(db.exec(`DELETE FROM organization_members WHERE user_id = '${BOB_ADMIN}'`)).rejects.toThrow(/au moins un administrateur/)
    await expect(db.exec(`UPDATE organization_members SET role = 'employee' WHERE user_id = '${BOB_ADMIN}'`)).rejects.toThrow(/au moins un administrateur/)
    await db.exec(`INSERT INTO organization_members (organization_id, user_id, role) VALUES ('${bobOrg}', '${OUTSIDER}', 'admin')`)
    await db.exec(`UPDATE organization_members SET active = false WHERE user_id = '${BOB_ADMIN}'`) // possible : un autre admin existe
  })
})

describe("synchronisation de l'équipe actuelle et audit", () => {
  beforeEach(async () => {
    await db.exec(M8)
    await db.exec(`INSERT INTO auth.users VALUES ('${OWNER}', 'o@e2b.tn'), ('${AGENT}', 'a@e2b.tn')`)
  })

  it("un conseiller ajouté / désactivé dans landing_staff (comme le fait l'application) suit automatiquement dans les membres", async () => {
    await db.exec(`INSERT INTO landing_staff (user_id, email, role) VALUES ('${OWNER}', 'o@e2b.tn', 'admin'), ('${AGENT}', 'a@e2b.tn', 'agent')`)
    const q = async () => (await db.query<{ role: string; active: boolean }>(`SELECT role, active FROM organization_members WHERE user_id = '${AGENT}'`)).rows[0]
    expect(await q()).toEqual({ role: "employee", active: true })
    await db.exec(`UPDATE landing_staff SET active = false WHERE user_id = '${AGENT}'`)
    expect(await q()).toEqual({ role: "employee", active: false })
    await db.exec(`UPDATE landing_staff SET role = 'admin', active = true WHERE user_id = '${AGENT}'`)
    expect(await q()).toEqual({ role: "admin", active: true })
  })

  it("un rôle « manager » (inconnu de landing_staff) n'est jamais rétrogradé par la synchronisation", async () => {
    await db.exec(`INSERT INTO landing_staff (user_id, email, role) VALUES ('${OWNER}', 'o@e2b.tn', 'admin'), ('${AGENT}', 'a@e2b.tn', 'agent')`)
    await db.exec(`UPDATE organization_members SET role = 'manager' WHERE user_id = '${AGENT}'`)
    await db.exec(`UPDATE landing_staff SET full_name = 'Sami' WHERE user_id = '${AGENT}'`)
    expect((await db.query<{ role: string }>(`SELECT role FROM organization_members WHERE user_id = '${AGENT}'`)).rows[0].role).toBe("manager")
  })

  it("l'audit trace création, ajout / changement de membre, suspension et Super Admin ; il est en ajout seul", async () => {
    await db.exec(`INSERT INTO landing_staff (user_id, email, role) VALUES ('${OWNER}', 'o@e2b.tn', 'admin'), ('${AGENT}', 'a@e2b.tn', 'agent')`)
    await db.exec(`UPDATE landing_staff SET active = false WHERE user_id = '${AGENT}'`)
    await db.exec(`UPDATE organizations SET status = 'suspended' WHERE id = '${E2B}'`)
    await db.exec(`INSERT INTO platform_admins (user_id) VALUES ('${OWNER}')`)
    const actions = (await db.query<{ action: string }>("SELECT action FROM organization_audit ORDER BY id")).rows.map((r) => r.action)
    expect(actions).toEqual(expect.arrayContaining(["organization_created", "member_added", "member_changed", "organization_status", "platform_admin_added"]))
    await expect(db.exec("UPDATE organization_audit SET action = 'x'")).rejects.toThrow(/ajout seul/)
    await expect(db.exec("DELETE FROM organization_audit")).rejects.toThrow(/ajout seul/)
    await expect(db.exec("TRUNCATE organization_audit")).rejects.toThrow(/ajout seul/)
  })
})

describe("compte Super Admin : script de provisionnement", () => {
  it("refuse sans migration 0008, s'arrête si le compte n'existe pas (rien créé), accorde le rôle à un compte existant, de façon idempotente", async () => {
    await expect(db.exec(PROVISION)).rejects.toThrow(/0008/)
    await db.exec(M8)
    await expect(db.exec(PROVISION)).rejects.toThrow(/aucun compte/)
    expect((await db.query("SELECT 1 FROM platform_admins")).rows.length).toBe(0)
    await db.exec(`INSERT INTO auth.users VALUES ('${SUPER}', 'tarhouni.hassene@gmail.com')`) // casse différente : retrouvé sans tenir compte de la casse
    await db.exec(PROVISION)
    await db.exec(PROVISION)
    expect((await db.query<{ user_id: string }>("SELECT user_id FROM platform_admins")).rows).toEqual([{ user_id: SUPER }])
  })

  it("le script ne contient aucune création de compte ni de mot de passe", () => {
    expect(PROVISION).not.toMatch(/INSERT INTO auth\.users|crypt\(|password/i)
  })
})

describe("retour arrière documenté", () => {
  it("remet le schéma dans l'état 0007 (colonnes, tables, politiques d'origine) sans perdre un seul lead", async () => {
    await db.exec(`INSERT INTO auth.users VALUES ('${OWNER}', 'o@e2b.tn')`)
    await db.exec(`INSERT INTO landing_staff (user_id, email, role) VALUES ('${OWNER}', 'o@e2b.tn', 'admin')`)
    await leadRow()
    await db.exec(M8)
    await leadRow()
    await db.exec(ROLLBACK)
    expect((await db.query("SELECT 1 FROM landing_leads")).rows.length).toBe(2)
    expect(to(await db.query("SELECT to_regclass('public.organizations') AS r"))).toBeNull()
    await expect(db.exec("SELECT organization_id FROM landing_leads")).rejects.toThrow(/organization_id/)
    // les politiques d'origine fonctionnent de nouveau : tout membre actif de l'équipe lit les leads
    expect((await asUser(OWNER, "SELECT 1 FROM landing_leads")).length).toBe(2)
    // et la migration peut être rejouée
    await db.exec(M8)
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM landing_leads WHERE organization_id = '" + E2B + "'")).rows[0].n).toBe(2)
  })

  it("refuse le retour arrière dès qu'une deuxième organisation existe (pas de mélange de données)", async () => {
    await db.exec(M8)
    await db.exec(`INSERT INTO organizations (slug, name) VALUES ('bob', 'Bob SARL')`)
    await expect(db.exec(ROLLBACK)).rejects.toThrow(/plusieurs organisations/)
    const other = new PGlite()
    await other.exec(STUB + BEFORE)
    await expect(other.exec(ROLLBACK)).rejects.toThrow(/0008 n'est pas appliquée/)
  })
})

function to(r: { rows: { r: unknown }[] }) {
  return r.rows[0].r
}
