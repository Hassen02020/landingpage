// Doublons de dossiers — règles pures (détection, fenêtres, offre, réservation). Jeux de données FICTIFS.
import { describe, expect, it } from "vitest"
import {
  COMMERCIAL_WINDOW_MS, DUP_STATUSES, TECHNICAL_WINDOW_MS, canTransition, compareOffer, compareOffering, detectCandidates, findReservationConflicts, normalizeOffer, suggestPrimary, type DupLead,
} from "@/lib/duplicates"

const T0 = Date.parse("2026-11-10T10:00:00Z")
const at = (ms: number) => new Date(T0 + ms).toISOString()
let n = 0
const lead = (o: Partial<DupLead> = {}): DupLead => ({ id: `id-${++n}`, organization_id: "org-1", phone: "21622000001", product: "omra", offer: "الفوج الأول — 27 جانفي 2027", offer_id: null, travel_date: null, created_at: at(0), status: "nouveau", ...o })

describe("normalisation et comparaison de l'offre", () => {
  it("ignore casse, accents, ponctuation, espaces, voyelles et allongements arabes", () => {
    expect(normalizeOffer("  Omra  Ramadan — COMPLET ")).toBe(normalizeOffer("omra ramadan complet"))
    expect(normalizeOffer("Séjour à Djerba")).toBe(normalizeOffer("sejour a djerba"))
    expect(normalizeOffer("الفَوْج الأوّل — 27 جانفي 2027")).toBe(normalizeOffer("الفوج الاول - 27 جانفي 2027".replace("الاول", "الأول")) ?? "") // marques arabes retirées
    expect(normalizeOffer("   ")).toBeNull(); expect(normalizeOffer(null)).toBeNull()
  })
  it("identifiant d'offre prioritaire ; sinon libellé ; sinon inconnu", () => {
    expect(compareOffer({ offer: "A", offer_id: "x" }, { offer: "B", offer_id: "x" })).toBe("same") // même identifiant malgré des libellés différents
    expect(compareOffer({ offer: "A", offer_id: "x" }, { offer: "A", offer_id: "y" })).toBe("different")
    expect(compareOffer({ offer: "Omra A", offer_id: null }, { offer: "omra  a", offer_id: null })).toBe("same")
    expect(compareOffer({ offer: "Omra A", offer_id: null }, { offer: "Omra B", offer_id: null })).toBe("different")
    expect(compareOffer({ offer: null, offer_id: null }, { offer: "Omra A", offer_id: null })).toBe("unknown")
    expect(compareOffer({ offer: "A", offer_id: "x" }, { offer: "A", offer_id: null })).toBe("same") // un seul identifiant : repli sur le libellé
  })
  it("offre ET départ : différent dès qu'un des deux diffère", () => {
    expect(compareOffering(lead({ travel_date: "2027-01-27" }), lead({ travel_date: "2027-02-18" }))).toBe("different")
    expect(compareOffering(lead({ offer: null, travel_date: "2027-01-27" }), lead({ offer: null, travel_date: "2027-01-27" }))).toBe("same")
    expect(compareOffering(lead({ offer: null }), lead({ offer: null }))).toBe("unknown")
  })
})

describe("détection : règles validées 15 minutes / 30 jours / intérêt renouvelé", () => {
  const base = lead({ id: "base" })
  const near = (ms: number, o: Partial<DupLead> = {}) => lead({ created_at: at(ms), ...o })
  it("règle 1 : ≤ 15 min, même client/produit/offre → technique ; frontière incluse, 15 min + 1 s → commerciale", () => {
    expect(detectCandidates(base, [near(14 * 60_000)])[0]).toMatchObject({ rule: "technique_15min", confidence: "elevee", primaryId: "base" })
    expect(detectCandidates(base, [near(TECHNICAL_WINDOW_MS)])[0].rule).toBe("technique_15min")
    expect(detectCandidates(base, [near(TECHNICAL_WINDOW_MS + 1000)])[0].rule).toBe("commerciale_30j")
  })
  it("règle 2 : ≤ 30 jours → commerciale ; 30 jours + 1 s → AUCUN signalement (règle 3 : intérêt renouvelé)", () => {
    expect(detectCandidates(base, [near(29 * 86_400_000)])[0].rule).toBe("commerciale_30j")
    expect(detectCandidates(base, [near(COMMERCIAL_WINDOW_MS)])[0].rule).toBe("commerciale_30j")
    expect(detectCandidates(base, [near(COMMERCIAL_WINDOW_MS + 1000)])).toEqual([])
    expect(detectCandidates(base, [near(-31 * 86_400_000)])).toEqual([]) // dans l'autre sens aussi
  })
  it("le plus récent est le candidat, le plus ancien le principal, quel que soit le dossier examiné", () => {
    const older = near(-10 * 60_000, { id: "older" })
    expect(detectCandidates(base, [older])[0]).toMatchObject({ candidateId: "base", primaryId: "older" })
    expect(detectCandidates(older, [base])[0]).toMatchObject({ candidateId: "base", primaryId: "older" })
  })
  it("offre ou départ différents → aucun signalement ; inconnus → confiance FAIBLE (jamais une affirmation)", () => {
    expect(detectCandidates(base, [near(60_000, { offer: "Autre offre" })])).toEqual([])
    expect(detectCandidates(lead({ travel_date: "2027-01-27" }), [near(60_000, { travel_date: "2027-02-18" })])).toEqual([]) // deux dates différentes
    expect(detectCandidates(base, [near(60_000, { travel_date: "2027-02-18" })])[0].confidence).toBe("elevee") // date d'un seul côté : le libellé identique décide
    const unknown = detectCandidates(lead({ offer: null }), [near(60_000, { offer: null })])
    expect(unknown[0].confidence).toBe("faible")
  })
  it("autre client, autre produit, numéro invalide ou absent, autre entreprise : aucun rapprochement", () => {
    expect(detectCandidates(base, [near(60_000, { phone: "21622000002" })])).toEqual([])
    expect(detectCandidates(base, [near(60_000, { product: "hotel" })])).toEqual([])
    expect(detectCandidates(lead({ phone: "123" }), [lead({ phone: "123" })])).toEqual([])
    expect(detectCandidates(lead({ phone: null }), [lead({ phone: null })])).toEqual([])
    expect(detectCandidates(base, [near(60_000, { organization_id: "org-2" })])).toEqual([])
  })
  it("dossiers de test, anonymisés et doublons déjà confirmés ignorés ; jamais soi-même", () => {
    expect(detectCandidates(base, [near(60_000, { is_test: true })])).toEqual([])
    expect(detectCandidates(base, [near(60_000, { anonymized_at: at(0) })])).toEqual([])
    expect(detectCandidates(base, [near(60_000, { duplicate_of: "x" })])).toEqual([])
    expect(detectCandidates(base, [base])).toEqual([])
    expect(detectCandidates(lead({ duplicate_of: "x" }), [near(60_000)])).toEqual([])
  })
  it("tri : le plus proche dans le temps d'abord", () => {
    const r = detectCandidates(base, [near(5 * 86_400_000, { id: "far" }), near(2 * 60_000, { id: "near" })])
    expect(r.map((c) => c.candidateId)).toEqual(["near", "far"])
  })
})

describe("dossier principal proposé (D7)", () => {
  it("celui qui porte déjà un Purchase envoyé, même s'il est plus récent ; sinon le plus ancien", () => {
    const a = { id: "a", created_at: at(0), purchaseSent: false }, b = { id: "b", created_at: at(60_000), purchaseSent: true }
    expect(suggestPrimary(a, b)).toEqual({ primaryId: "b", candidateId: "a", reason: "purchase_envoye" })
    expect(suggestPrimary({ ...b, purchaseSent: false }, a)).toEqual({ primaryId: "a", candidateId: "b", reason: "plus_ancien" })
  })
})

describe("conflit de réservation : une réservation = une vente", () => {
  const cur = lead({ id: "cur", status: "contacte" })
  it("un autre dossier réservé ou gagné, même clé → conflit (sans fenêtre de temps)", () => {
    const r = findReservationConflicts(cur, [{ ...lead({ id: "o1", status: "reserve", created_at: at(-200 * 86_400_000) }), ref: "E2B-AAAAAA" }])
    expect(r).toEqual([{ id: "o1", ref: "E2B-AAAAAA", status: "reserve", confidence: "elevee" }])
    expect(findReservationConflicts(cur, [lead({ id: "o2", status: "gagne" })])).toHaveLength(1)
  })
  it("Purchase déjà envoyé ou en attente = conflit même si le statut n'est plus « réservé »", () => {
    expect(findReservationConflicts(cur, [{ ...lead({ id: "o3", status: "perdu" }), purchaseSentOrPending: true }])).toHaveLength(1)
  })
  it("aucun conflit : dossier non réservé, autre offre, autre client, doublon déjà confirmé, test, soi-même", () => {
    expect(findReservationConflicts(cur, [lead({ status: "contacte" })])).toEqual([])
    expect(findReservationConflicts(cur, [lead({ status: "reserve", offer: "Autre offre" })])).toEqual([])
    expect(findReservationConflicts(cur, [lead({ status: "reserve", phone: "21622000002" })])).toEqual([])
    expect(findReservationConflicts(cur, [lead({ status: "reserve", duplicate_of: "x" })])).toEqual([])
    expect(findReservationConflicts(cur, [lead({ status: "reserve", is_test: true })])).toEqual([])
    expect(findReservationConflicts(cur, [{ ...cur, status: "reserve" }])).toEqual([])
    expect(findReservationConflicts(lead({ phone: null }), [lead({ status: "reserve", phone: null })])).toEqual([])
  })
  it("offre inconnue d'un côté : conflit à confiance FAIBLE (avertissement, pas une affirmation)", () => {
    expect(findReservationConflicts(lead({ offer: null }), [lead({ status: "reserve" })])[0].confidence).toBe("faible")
  })
})

describe("statuts et transitions", () => {
  it("3 statuts stockés ; décision et réouverture seulement ; jamais confirmé ↔ rejeté", () => {
    expect(DUP_STATUSES).toEqual(["signale", "confirme", "rejete"])
    expect(canTransition("signale", "confirme")).toBe(true); expect(canTransition("signale", "rejete")).toBe(true)
    expect(canTransition("confirme", "signale")).toBe(true); expect(canTransition("rejete", "signale")).toBe(true)
    expect(canTransition("confirme", "rejete")).toBe(false); expect(canTransition("rejete", "confirme")).toBe(false)
    expect(canTransition("signale", "signale")).toBe(false)
  })
})
