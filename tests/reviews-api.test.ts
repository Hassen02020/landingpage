import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }))
const submit = vi.fn(async (_i: unknown, _o?: { allow?: () => boolean }) => ({ ok: true }) as unknown)
const list = vi.fn(async (_p: string) => ({ count: 1, average: 5, reviews: [{ rating: 5, name: "Amine", comment: null, created_at: "2026-11-14T12:00:00Z" }] }))
vi.mock("@/lib/server/reviews", () => ({ submitReview: (i: unknown, o?: { allow?: () => boolean }) => submit(i, o), listPublished: (p: string) => list(p) }))
vi.mock("@/lib/server/db", () => ({ withPublicOrg: async (fn: () => unknown) => fn() }))

import { GET, POST } from "@/app/api/reviews/route"
import { __resetGuards } from "@/lib/server/guard"

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new NextRequest("https://landingpage-easy2book.vercel.app/api/reviews", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json", host: "landingpage-easy2book.vercel.app", "x-forwarded-for": "1.2.3.4", ...headers } }))
const good = { page: "omra", rating: 5, name: "Amine", comment: "ok", consent: true }

// comme le vrai service : `allow` n'est interrogé que pour un avis valide
const valid = async (_i: unknown, o?: { allow?: () => boolean }) => (o?.allow && !o.allow() ? { ok: false, reason: "rate" } : { ok: true })
beforeEach(() => { __resetGuards(); submit.mockReset(); list.mockClear(); submit.mockImplementation(valid) })
afterEach(() => vi.unstubAllEnvs())

describe("POST /api/reviews", () => {
  it("201 pour un avis valide ; le serveur reçoit uniquement les champs attendus", async () => {
    const r = await post({ ...good, status: "published", organization_id: "x", moderated_at: "2026" })
    expect(r.status).toBe(201)
    expect(await r.json()).toEqual({ ok: true })
    const arg = submit.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(arg).sort()).toEqual(["comment", "consent", "lang", "name", "page", "rating", "website"]) // statut, entreprise, modération : jamais transmis
  })
  it("origine d'un autre site refusée (403) ; rien n'est enregistré", async () => {
    const r = await post(good, { origin: "https://evil.test" })
    expect(r.status).toBe(403)
    expect(submit).not.toHaveBeenCalled()
  })
  it("JSON invalide, tableau ou corps trop gros : 400 / 413", async () => {
    expect((await post("pas du json")).status).toBe(400)
    expect((await post("[1,2]")).status).toBe(400)
    expect((await post("x".repeat(5000))).status).toBe(413)
    expect(submit).not.toHaveBeenCalled()
  })
  it("erreurs de validation : 400 avec le détail par champ ; service indisponible : 503", async () => {
    submit.mockImplementationOnce(async () => ({ ok: false, reason: "invalid", errors: { rating: "Choisissez une note." } }))
    const bad = await post({ ...good, rating: 0 })
    expect(bad.status).toBe(400); expect(await bad.json()).toEqual({ ok: false, errors: { rating: "Choisissez une note." } })
    submit.mockImplementationOnce(async () => ({ ok: false, reason: "unavailable" }))
    expect((await post(good)).status).toBe(503)
  })
  it("limitation : 3 avis VALIDES par heure et par adresse (4e refusé en 429), une autre adresse reste acceptée", async () => {
    for (let i = 0; i < 3; i++) expect((await post(good)).status).toBe(201)
    expect((await post(good)).status).toBe(429)
    expect((await post(good, { "x-forwarded-for": "9.9.9.9" })).status).toBe(201)
  })
  it("les envois INVALIDES ne consomment pas le quota des avis valides (une faute de saisie n'est pas pénalisée)", async () => {
    submit.mockImplementation(async (i, o) => ((i as { rating: number }).rating === 0 ? { ok: false, reason: "invalid", errors: { rating: "x" } } : valid(i, o)))
    for (let i = 0; i < 10; i++) expect((await post({ ...good, rating: 0 })).status).toBe(400)
    for (let i = 0; i < 3; i++) expect((await post(good)).status).toBe(201)
    expect((await post(good)).status).toBe(429)
  })
  it("inondation : au-delà de 30 envois par heure depuis la même adresse, tout est refusé (429), valide ou non", async () => {
    submit.mockImplementation(async () => ({ ok: false, reason: "invalid", errors: {} }))
    for (let i = 0; i < 30; i++) expect((await post({ ...good, rating: 0 })).status).toBe(400)
    expect((await post({ ...good, rating: 0 })).status).toBe(429)
  })
  it("limitation globale : 20 avis valides par heure pour tout le site", async () => {
    for (let i = 0; i < 20; i++) expect((await post(good, { "x-forwarded-for": `10.0.0.${i + 1}` })).status).toBe(201)
    expect((await post(good, { "x-forwarded-for": "10.0.1.1" })).status).toBe(429)
  })
})

describe("GET /api/reviews", () => {
  it("renvoie les avis publiés avec une mise en cache courte ; la page demandée est transmise", async () => {
    const r = await GET(new NextRequest("https://landingpage-easy2book.vercel.app/api/reviews?page=omra"))
    expect(r.status).toBe(200)
    expect(list).toHaveBeenCalledWith("omra")
    expect(r.headers.get("cache-control")).toContain("s-maxage=60")
    expect(r.headers.get("cache-control")).toContain("max-age=0") // jamais conservé par le navigateur : un avis retiré disparaît aussitôt
    expect(r.headers.get("cache-control")).not.toContain("stale-while-revalidate")
    expect((await r.json()).reviews[0]).toEqual({ rating: 5, name: "Amine", comment: null, created_at: "2026-11-14T12:00:00Z" })
  })
})
