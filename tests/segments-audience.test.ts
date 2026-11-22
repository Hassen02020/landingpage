// D1 (garde-fou de sensibilité) et D2 (fiche de segment). Jeux de données FICTIFS.
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { SEGMENTS, SENSITIVE_PRODUCTS, adAudienceVerdict, evaluate, getSegment } from "@/lib/segments"
import { GOOD_SAMPLE, MAX_EXCLUDED_SHARE, MIN_SAMPLE, profileSegment } from "@/lib/segment-profile"
import type { CustomerSummary } from "@/lib/server/customer"

const NOW = Date.parse("2026-11-22T12:00:00Z")
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString()
let seq = 0
const cust = (o: Partial<CustomerSummary> = {}): CustomerSummary => ({
  phone: `2169${String(++seq).padStart(7, "0")}`, name: "Client Test", leads: 1, openLeads: 0, booked: 0, revenue: 0, lastActivityAt: day(90), firstSeenAt: day(120),
  products: ["hotel"], channels: ["form"], region: "Tunis", marketingOk: true, lastStatus: "perdu", tier: "standard" as CustomerSummary["tier"], ...o,
})

describe("D1 — garde-fou de sensibilité", () => {
  it("« Omra sans réservation » est sensible : audience publicitaire INTERDITE", () => {
    const s = getSegment("omra-sans-reservation")!
    expect(s.sensitivity).toBe("sensitive")
    expect(adAudienceVerdict(s)).toMatchObject({ allowed: false }); expect(adAudienceVerdict(s).reason).toMatch(/sensible/i)
  })
  it("un segment de suivi n'est jamais une audience publicitaire", () => {
    for (const s of SEGMENTS.filter((x) => x.kind === "suivi")) expect(adAudienceVerdict(s).allowed).toBe(false)
  })
  it("un segment marketing non sensible est seulement ÉLIGIBLE À L'EXAMEN (jamais une activation)", () => {
    const v = adAudienceVerdict(getSegment("clients-reserves")!)
    expect(v.allowed).toBe(true); expect(v.reason).toMatch(/validation humaine/i); expect(v.reason).toMatch(/Rien n'est activé/)
  })
  it("GARDE STRUCTUREL : tout segment dont l'appartenance dépend d'un produit sensible DOIT être déclaré « sensible »", () => {
    const bases = [
      cust({ booked: 0, openLeads: 0, lastStatus: "perdu", lastActivityAt: day(90) }),
      cust({ booked: 1, revenue: 99999, openLeads: 0, lastStatus: "gagne", lastActivityAt: day(10) }),
      cust({ booked: 0, openLeads: 1, lastStatus: "nouveau", lastActivityAt: day(10), region: null }),
      cust({ booked: 0, openLeads: 1, lastStatus: "devis", lastActivityAt: day(10) }),
      cust({ booked: 0, openLeads: 0, lastStatus: "perdu", lastActivityAt: day(70), marketingOk: false }),
    ]
    for (const sensitive of SENSITIVE_PRODUCTS) {
      for (const seg of SEGMENTS) {
        const dependsOnIt = bases.some((b) => seg.match({ ...b, products: [sensitive] }, NOW) !== seg.match({ ...b, products: ["hotel"] }, NOW))
        if (dependsOnIt) expect(seg.sensitivity, `le segment « ${seg.slug} » dépend du produit sensible « ${sensitive} » : il doit être déclaré sensible`).toBe("sensitive")
      }
    }
    // et le garde-fou détecte bien le cas connu (sinon il ne prouverait rien)
    const omra = getSegment("omra-sans-reservation")!
    expect(omra.match({ ...bases[0], products: ["omra"] }, NOW)).not.toBe(omra.match({ ...bases[0], products: ["hotel"] }, NOW))
  })
  it("aucun segment sensible ne peut devenir « allowed » : verdict refusé pour toute combinaison", () => {
    for (const kind of ["suivi", "marketing"] as const) expect(adAudienceVerdict({ kind, sensitivity: "sensitive" }).allowed).toBe(false)
  })
  it("la page des segments ne contient aucun export ni envoi vers une plateforme publicitaire", () => {
    const page = readFileSync(new URL("../app/admin/(crm)/segments/page.tsx", import.meta.url), "utf8")
    expect(page).not.toMatch(/graph\.facebook|business-api\.tiktok|\/admin\/export|custom_audience|audiences?\//i)
  })
})

describe("D2 — fiche de segment", () => {
  const result = (n: number, o: Partial<CustomerSummary> = {}) => evaluate(Array.from({ length: n }, () => cust({ booked: 1, lastStatus: "gagne", ...o })), NOW).find((r) => r.segment.slug === "clients-reserves")!
  it("échantillon sous le seuil : fiabilité « insuffisante », jamais de conclusion", () => {
    const p = profileSegment(result(MIN_SAMPLE - 1))
    expect(p.reliability).toBe("insuffisante"); expect(p.reasons[0]).toMatch(/aucune conclusion/)
  })
  it("échantillon moyen puis suffisant : moyenne puis élevée", () => {
    expect(profileSegment(result(MIN_SAMPLE)).reliability).toBe("moyenne")
    expect(profileSegment(result(GOOD_SAMPLE)).reliability).toBe("elevee")
  })
  it("région presque inconnue : fiabilité dégradée avec la raison", () => {
    const p = profileSegment(result(GOOD_SAMPLE, { region: null }))
    expect(p.reliability).toBe("moyenne"); expect(p.reasons.join(" ")).toMatch(/Région connue/)
  })
  it("beaucoup d'exclus faute de consentement : fiabilité dégradée, effectif éligible ≠ effectif total", () => {
    const customers = [...Array.from({ length: GOOD_SAMPLE }, () => cust({ booked: 1, lastStatus: "gagne" })), ...Array.from({ length: GOOD_SAMPLE * 2 }, () => cust({ booked: 1, lastStatus: "gagne", marketingOk: false }))]
    const r = evaluate(customers, NOW).find((x) => x.segment.slug === "clients-reserves")!
    const p = profileSegment(r)
    expect(p.size).toBe(GOOD_SAMPLE * 3); expect(p.eligible).toBe(GOOD_SAMPLE); expect(p.excluded).toBe(GOOD_SAMPLE * 2)
    expect(p.excluded / p.size).toBeGreaterThan(MAX_EXCLUDED_SHARE); expect(p.reliability).toBe("moyenne")
  })
  it("provenance : canaux des contacts éligibles, du plus fréquent au moins fréquent", () => {
    const customers = [cust({ booked: 1, lastStatus: "gagne", channels: ["form"] }), cust({ booked: 1, lastStatus: "gagne", channels: ["form"] }), cust({ booked: 1, lastStatus: "gagne", channels: ["whatsapp"] }), cust({ booked: 1, lastStatus: "gagne", channels: [] })]
    const p = profileSegment(evaluate(customers, NOW).find((x) => x.segment.slug === "clients-reserves")!)
    expect(p.sources[0]).toEqual({ channel: "form", count: 2 }); expect(p.sources.map((s) => s.channel)).toEqual(expect.arrayContaining(["whatsapp", "inconnu"]))
  })
  it("la fiche ne contient ni téléphone ni nom", () => {
    const p = profileSegment(result(5))
    expect(JSON.stringify(p)).not.toMatch(/2169\d{7}|Client Test|phone|name/i)
  })
  it("la fiche d'un segment sensible affiche l'audience publicitaire interdite", () => {
    const r = evaluate([cust({ products: ["omra"], booked: 0, openLeads: 0, lastStatus: "perdu" })], NOW).find((x) => x.segment.slug === "omra-sans-reservation")!
    expect(profileSegment(r).adAudience.allowed).toBe(false)
  })
})
