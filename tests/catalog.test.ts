import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { publicCategory, seatsLeft, slugify, validateCategory, validateOffer } from "@/lib/server/catalog"
import { resetProtectionCache } from "@/lib/server/protection"
import { configureAll, installFetchMock, post } from "./helpers"
import { POST as leadsPOST } from "@/app/api/leads/route"
import { arDate } from "@/lib/dates-ar"

const read = (f: string) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8")
const ALL = ["0001_landing_leads.sql", "0002_landing_crm.sql", "0003_landing_admin.sql"].map(read).join("\n")
const M4 = read("0004_landing_catalog.sql")
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

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("migration 0004_landing_catalog.sql", () => {
  let db: PGlite
  beforeEach(async () => {
    db = new PGlite()
    await db.exec(STUB)
  })

  it("exige 0003, refuse une seconde exécution, crée la catégorie Omra et les 3 départs en ligne", async () => {
    await expect(db.exec(M4)).rejects.toThrow(/0003/)
    await db.exec(ALL)
    await db.exec(M4)
    await expect(db.exec(M4)).rejects.toThrow(/déjà/)
    const offers = (await db.query<{ name: string; price: string; departure_date: string; nights: number }>(
      "SELECT o.name, o.price, o.departure_date::text, o.nights FROM landing_offers o JOIN landing_categories c ON c.id = o.category_id WHERE c.slug = 'omra-2027' AND o.visible ORDER BY o.position"
    )).rows
    expect(offers.map((o) => [o.name, Number(o.price), o.departure_date, o.nights])).toEqual([
      ["الفوج الأول", 5500, "2027-01-27", 14],
      ["الفوج الثاني", 7800, "2027-02-18", 25],
      ["عمرة شوال", 4800, "2027-03-15", 14],
    ])
    expect((await db.query("SELECT id FROM storage.buckets WHERE id = 'landing-media' AND public")).rows).toHaveLength(1)
  })

  it("aucun accès API (anon / connectés) ; service_role sans DELETE ; contraintes métier", async () => {
    await db.exec(ALL + M4)
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`)
      await expect(db.query("SELECT cost FROM landing_offers")).rejects.toThrow(/permission denied/)
      await db.exec("RESET ROLE")
    }
    await db.exec("SET ROLE service_role")
    await expect(db.query("DELETE FROM landing_offers")).rejects.toThrow(/permission denied/)
    await db.exec("RESET ROLE")
    await expect(db.query("UPDATE landing_offers SET seats_total = 10, seats_sold = 11")).rejects.toThrow(/check/i)
    await expect(db.query("INSERT INTO landing_categories (slug, name, product) VALUES ('Bad Slug', 'x y', 'voyage')")).rejects.toThrow(/check/i)
    await expect(db.query("UPDATE landing_offers SET image_url = 'javascript:alert(1)'")).rejects.toThrow(/check/i)
    await db.query("UPDATE landing_offers SET image_url = 'https://tdexdlukqciolslvjmhd.supabase.co/storage/v1/object/public/landing-media/offers/a.jpg'")
    await db.query("UPDATE landing_categories SET banner_desktop = '/omra-hero.jpg', banner_mobile = '/omra-hero.jpg'")
  })
})

describe("catalogue : validation et lecture publique", () => {
  it("valide une offre (prix requis, places cohérentes, SKU, lien d'image sûr)", () => {
    const ok = validateOffer({ name: "Turquie 8 jours", product: "voyage", price: "2 450", cost: "1900", seats_total: "30", seats_sold: "4", sku: "tr-0827", visible: "on" }, ["Vol", " ", "Hôtel 4*"])
    expect(ok.row).toMatchObject({ name: "Turquie 8 jours", price: 2450, cost: 1900, seats_total: 30, seats_sold: 4, sku: "TR-0827", visible: true, features: ["Vol", "Hôtel 4*"] })
    const bad = validateOffer({ name: "x", product: "", price: "", seats_total: "2", seats_sold: "5", image_url: "javascript:alert(1)" }, [])
    expect(Object.keys(bad.errors).sort()).toEqual(["image_url", "name", "price", "product", "seats_sold"])
  })

  it("valide une catégorie (adresse, SEO 70 / 160)", () => {
    expect(validateCategory({ name: "Été en Turquie 2027", product: "voyage" }).row).toMatchObject({ slug: "ete-en-turquie-2027", lang: "fr" })
    expect(validateCategory({ name: "Xx", product: "voyage", slug: "Bad Slug", seo_title: "t".repeat(71) }).errors).toMatchObject({ slug: expect.any(String), seo_title: expect.any(String) })
    expect(slugify("Omra Ramadan — 2027 !")).toBe("omra-ramadan-2027")
  })

  it("la lecture publique ne demande jamais le coût et seulement les offres visibles et non archivées", async () => {
    configureAll()
    const f = installFetchMock()
    f.db.landing_categories = [{ id: "c1", slug: "omra-2027", visible: true }]
    await publicCategory("omra-2027")
    const offerCall = f.dbCalls().find((c) => c.url.includes("/landing_offers"))!
    const url = decodeURIComponent(offerCall.url)
    expect(url).toContain("visible=eq.true")
    expect(url).toContain("archived_at=is.null")
    expect(url.match(/select=([^&]+)/)![1].split(",")).not.toContain("cost")
    expect(await publicCategory("../../etc")).toBeNull()
  })

  it("places restantes et dates arabes", () => {
    expect(seatsLeft({ seats_total: null, seats_sold: 0 })).toBeNull()
    expect(seatsLeft({ seats_total: 10, seats_sold: 12 })).toBe(0)
    expect(arDate("2027-02-18")).toEqual({ full: "18 فيفري 2027", short: "18 فيفري", month: "فيفري 2027" })
  })
})

describe("/api/leads et le lien vers l'offre", () => {
  it("enregistre offer_id ; si l'offre n'existe pas (clé étrangère), le lead est enregistré sans le lien", async () => {
    configureAll()
    resetProtectionCache()
    const f = installFetchMock()
    const offerId = "11111111-2222-3333-4444-555555555555"
    const res = await leadsPOST(post("/api/leads", { name: "Ahmed Ben Ali", phone: "22123456", product: "omra", contactConsent: true, offer: "الفوج الثاني — 18 فيفري 2027", offer_id: offerId }))
    expect((await res.json()).stored).toBe(true)
    expect(f.db.landing_leads[0].offer_id).toBe(offerId)

    // base qui refuse la clé étrangère une fois
    let first = true
    const orig = globalThis.fetch
    vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
      if (String(url).endsWith("/rest/v1/landing_leads") && init.method === "POST" && first) {
        first = false
        return new Response(JSON.stringify({ code: "23503" }), { status: 409 })
      }
      return orig(url as string, init)
    }))
    const res2 = await leadsPOST(post("/api/leads", { name: "Sami Test", phone: "23123456", product: "omra", contactConsent: true, offer_id: offerId }))
    expect((await res2.json()).stored).toBe(true)
    expect(f.db.landing_leads[1].offer_id).toBeUndefined()
  })
})
