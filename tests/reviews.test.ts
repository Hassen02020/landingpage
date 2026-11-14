import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))

import { cleanText, countPending, listForAdmin, listPublished, moderateReview, submitReview } from "@/lib/server/reviews"
import { resetPublicOrgCache, resetTenantModeCache } from "@/lib/server/db"
import { configureAll } from "./helpers"

const E2B = "00000000-0000-4000-8000-0000000e2b01"
interface Row { id: string; organization_id: string; page_key: string; rating: number; first_name: string; comment: string | null; lang: string; publish_consent: boolean; status: string; content_hash: string; created_at: string; moderated_at: string | null }
let rows: Row[]
let mode: "ok" | "missing" | "down"
let seq = 0

beforeEach(() => {
  configureAll()
  vi.stubEnv("LANDING_SUPABASE_SERVICE_ROLE_KEY", "service-role-test-0123456789")
  resetTenantModeCache(); resetPublicOrgCache()
  rows = []; mode = "ok"; seq = 0
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit = {}) => {
    const u = decodeURIComponent(String(url))
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (u.includes("/rest/v1/organizations?")) return json([{ id: E2B }])
    if (mode === "missing") return json({ code: "42P01" }, 404)
    if (mode === "down") return json({}, 500)
    const method = (init.method || "GET").toUpperCase()
    if (method === "POST") {
      const b = JSON.parse(String(init.body))
      if (rows.some((r) => r.organization_id === b.organization_id && r.page_key === b.page_key && r.content_hash === b.content_hash)) return json({ code: "23505" }, 409)
      const row = { id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, created_at: new Date(2026, 10, 14, 12, seq).toISOString(), moderated_at: null, ...b } as Row
      rows.push(row); return json([row], 201)
    }
    const status = u.match(/status=eq\.(\w+)/)?.[1]
    const org = u.match(/organization_id=eq\.([0-9a-f-]+)/)?.[1]
    const id = u.match(/[?&]id=eq\.([0-9a-f-]+)/)?.[1]
    const page = u.match(/page_key=eq\.([a-z0-9-]+)/)?.[1]
    const match = rows.filter((r) => (!status || r.status === status) && (!org || r.organization_id === org) && (!id || r.id === id) && (!page || r.page_key === page))
    if (method === "PATCH") { const p = JSON.parse(String(init.body)); match.forEach((r) => Object.assign(r, p)); return json(match) }
    const limit = Number(u.match(/limit=(\d+)/)?.[1] ?? 1000)
    const sorted = u.includes("order=created_at.desc") ? [...match].sort((a, b) => b.created_at.localeCompare(a.created_at)) : match
    return json(sorted.slice(0, limit))
  }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

const ok = { page: "omra", rating: 5, name: "Amine", comment: "رحلة منظمة جداً", consent: true }

describe("dépôt d'un avis", () => {
  it("enregistre un avis « EN ATTENTE » dans l'entreprise du site, jamais publié automatiquement", async () => {
    expect(await submitReview(ok)).toEqual({ ok: true })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ organization_id: E2B, page_key: "omra", rating: 5, first_name: "Amine", status: "pending", publish_consent: true, lang: "ar" })
    expect((await listPublished("omra")).count).toBe(0)
  })
  it("note de 1 à 5 entière : refusée sinon (0, 6, 3.5, texte, vide)", async () => {
    for (const rating of [0, 6, 3.5, "abc", "", null, undefined, -1]) {
      const r = await submitReview({ ...ok, rating })
      expect(r, String(rating)).toMatchObject({ ok: false, reason: "invalid", errors: { rating: expect.any(String) } })
    }
    expect((await submitReview({ ...ok, rating: "4" })).ok).toBe(true) // « 4 » en texte (formulaire) accepté
    expect(rows).toHaveLength(1)
  })
  it("prénom requis (2 à 60) ; accord de publication OBLIGATOIRE ; page inconnue refusée", async () => {
    expect(await submitReview({ ...ok, name: "A" })).toMatchObject({ errors: { name: expect.any(String) } })
    expect(await submitReview({ ...ok, name: "   " })).toMatchObject({ errors: { name: expect.any(String) } })
    expect(await submitReview({ ...ok, consent: false })).toMatchObject({ errors: { consent: expect.any(String) } })
    expect(await submitReview({ ...ok, consent: undefined })).toMatchObject({ errors: { consent: expect.any(String) } })
    expect(await submitReview({ ...ok, page: "admin" })).toMatchObject({ errors: { page: expect.any(String) } })
    expect(rows).toHaveLength(0)
  })
  it("anti-spam : adresse web, e-mail, téléphone collés ou commentaire trop long refusés", async () => {
    for (const comment of ["visitez https://promo.test", "www.promo.test", "écrivez à moi@promo.com", "appelez le +216 98 140 514", "promo.xyz", "x".repeat(601)]) {
      expect(await submitReview({ ...ok, comment }), comment.slice(0, 30)).toMatchObject({ ok: false, errors: { comment: expect.any(String) } })
    }
    expect(rows).toHaveLength(0)
  })
  it("balises et caractères de contrôle retirés ; le texte est conservé brut", async () => {
    await submitReview({ ...ok, name: "<b>Amine</b>", comment: "Très\u0000 bien <script>alert(1)</script> merci" })
    expect(rows[0].first_name).toBe("Amine")
    expect(rows[0].comment).not.toContain("<")
    expect(rows[0].comment).not.toContain("\u0000")
    expect(cleanText("  a   b  ", 10)).toBe("a b")
  })
  it("champ piège rempli (robot) : réponse « reçu » mais RIEN n'est enregistré", async () => {
    expect(await submitReview({ ...ok, website: "http://spam.test" })).toEqual({ ok: true })
    expect(rows).toHaveLength(0)
  })
  it("même avis envoyé deux fois : un seul enregistré, sans erreur pour le visiteur", async () => {
    await submitReview(ok); expect(await submitReview(ok)).toEqual({ ok: true })
    expect(rows).toHaveLength(1)
  })
  it("limitation : `allow` n'est interrogé que pour un avis valide ; refusé → rien n'est enregistré", async () => {
    const allow = vi.fn(() => false)
    expect(await submitReview({ ...ok, rating: 0 }, { allow })).toMatchObject({ reason: "invalid" })
    expect(allow).not.toHaveBeenCalled()
    expect(await submitReview(ok, { allow })).toEqual({ ok: false, reason: "rate" })
    expect(allow).toHaveBeenCalledTimes(1)
    expect(rows).toHaveLength(0)
    expect(await submitReview(ok, { allow: () => true })).toEqual({ ok: true })
    expect(rows).toHaveLength(1)
  })
  it("migration 0025 absente ou base en panne : « indisponible », jamais d'exception", async () => {
    mode = "missing"; expect(await submitReview(ok)).toEqual({ ok: false, reason: "unavailable" })
    mode = "down"; expect(await submitReview(ok)).toEqual({ ok: false, reason: "unavailable" })
  })
})

describe("lecture publique : seulement les avis PUBLIÉS", () => {
  const add = async (name: string, rating: number, status: "pending" | "published" | "rejected") => {
    await submitReview({ ...ok, name, rating, comment: `avis de ${name}` })
    const row = rows[rows.length - 1]; row.status = status; if (status !== "pending") row.moderated_at = new Date().toISOString()
  }
  it("sans avis publié : aucune moyenne (null), aucun avis", async () => {
    await add("Attente", 5, "pending"); await add("Refusé", 1, "rejected")
    expect(await listPublished("omra")).toEqual({ count: 0, average: null, reviews: [] })
  })
  it("la moyenne et le nombre ne portent QUE sur les avis publiés ; les plus récents d'abord ; champs minimaux", async () => {
    await add("Un", 5, "published"); await add("Deux", 4, "published"); await add("Trois", 4, "published"); await add("Refusé", 1, "rejected"); await add("Attente", 1, "pending")
    const p = await listPublished("omra")
    expect(p.count).toBe(3)
    expect(p.average).toBe(4.3)
    expect(p.reviews.map((r) => r.name)).toEqual(["Trois", "Deux", "Un"])
    expect(Object.keys(p.reviews[0]).sort()).toEqual(["comment", "created_at", "name", "rating"]) // ni identifiant, ni langue, ni statut, ni empreinte
    expect(JSON.stringify(p)).not.toContain("Refusé")
    expect(JSON.stringify(p)).not.toContain("Attente")
  })
  it("page inconnue ou table absente : réponse vide, sans erreur", async () => {
    expect(await listPublished("admin")).toEqual({ count: 0, average: null, reviews: [] })
    mode = "missing"; expect(await listPublished("omra")).toEqual({ count: 0, average: null, reviews: [] })
  })
})

describe("modération", () => {
  it("publier, retirer, refuser : seul le statut et la date changent, la note et le texte jamais", async () => {
    await submitReview(ok)
    const id = rows[0].id
    expect(await moderateReview(id, "published", "user-1")).toEqual({ ok: true })
    expect(rows[0]).toMatchObject({ status: "published", rating: 5, comment: "رحلة منظمة جداً" })
    expect(rows[0].moderated_at).toBeTruthy()
    expect((await listPublished("omra")).count).toBe(1)
    expect(await moderateReview(id, "rejected", "user-1")).toEqual({ ok: true })
    expect((await listPublished("omra")).count).toBe(0)
  })
  it("identifiant invalide ou inconnu, statut invalide : refusés ; compteurs et listes d'administration", async () => {
    expect(await moderateReview("pas-un-uuid", "published", null)).toMatchObject({ ok: false })
    expect(await moderateReview("00000000-0000-4000-8000-000000009999", "published", null)).toMatchObject({ ok: false })
    expect(await moderateReview(rows[0]?.id ?? "00000000-0000-4000-8000-000000000001", "pending" as never, null)).toMatchObject({ ok: false })
    await submitReview(ok); await submitReview({ ...ok, name: "Samir" })
    expect(await countPending()).toBe(2)
    expect((await listForAdmin("pending")).reviews).toHaveLength(2)
    expect((await listForAdmin("published")).reviews).toHaveLength(0)
    mode = "missing"
    expect(await listForAdmin("pending")).toMatchObject({ tableMissing: true })
    expect(await moderateReview("00000000-0000-4000-8000-000000000001", "published", null)).toMatchObject({ ok: false, error: expect.stringContaining("0025") })
  })
})
