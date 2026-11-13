import { describe, expect, it } from "vitest"
import { economics, leadNetwork, normalizeCampaign, type CommissionRow, type EconLead, type SpendRow } from "../lib/ad-economics"
import type { FunnelActivity } from "../lib/server/analytics"
import type { Status } from "../lib/status"

let n = 0
const lead = (o: Partial<EconLead> & { status?: Status } = {}): EconLead => ({
  id: o.id ?? `L${++n}`, created_at: "2026-11-02T10:00:00Z", status: o.status ?? "nouveau", booking_value: null, booked_at: null,
  channel: "meta", utm_campaign: "Omra 2027", product: "omra", niche: "omra-ramadan", ...o,
})
const act = (lead_id: string, to: Status): FunnelActivity => ({ lead_id, type: "status_change", to_status: to, created_at: "2026-11-03T10:00:00Z", actor_id: null })
const spend = (amount: number, over: Partial<SpendRow> = {}): SpendRow => ({ spend_date: "2026-11-05", network: "meta", campaign: "Omra 2027", amount_tnd: amount, ...over })
const com = (lead_id: string, amount: number, over: Partial<CommissionRow> = {}): CommissionRow => ({ lead_id, kind: amount > 0 ? "commission" : "annulation", amount_tnd: amount, status: "confirme", ...over })
const empty = { leads: [], activities: [], spends: [], commissions: [] }

describe("formules de rentabilité", () => {
  it("exemple du cahier des charges : 1 000 TND de dépenses, 3 000 TND de commissions nettes → +2 000 TND, 300 %", () => {
    const l = lead({ status: "reserve", booked_at: "2026-11-08" })
    const r = economics({ leads: [l], activities: [], spends: [spend(1000)], commissions: [com(l.id, 3000)] }, "network")
    expect(r.total.metrics).toMatchObject({ spend: 1000, commissionNet: 3000, result: 2000, profitabilityPct: 300 })
  })

  it("dépenses nulles : rentabilité NON CALCULABLE (null), jamais 0 % ; le résultat reste la commission", () => {
    const l = lead({ status: "reserve", booked_at: "2026-11-08" })
    const m = economics({ leads: [l], activities: [], spends: [], commissions: [com(l.id, 500)] }, "network").total.metrics
    expect(m.profitabilityPct).toBeNull()
    expect(m.result).toBe(500)
    expect(m.cpl).toBeNull()
    expect(m.costPerBooking).toBeNull()
  })

  it("coûts : CPL, coût par qualifié, par devis, par réservation ; taux de qualification, de devis, de réservation", () => {
    const leads = [lead({ id: "a", status: "nouveau" }), lead({ id: "b", status: "qualifie" }), lead({ id: "c", status: "devis" }), lead({ id: "d", status: "reserve", booked_at: "2026-11-08" })]
    const m = economics({ leads, activities: [], spends: [spend(400)], commissions: [] }, "network").total.metrics
    expect(m).toMatchObject({ leads: 4, qualified: 3, quotes: 2, bookings: 1, cpl: 100, costPerQualified: 133.333, costPerQuote: 200, costPerBooking: 400 })
    expect(m).toMatchObject({ qualificationRate: 75, quoteRate: 50, bookingRate: 25 })
  })

  it("aucun lead : coûts « — » (null), pas de division par zéro", () => {
    const m = economics({ ...empty, spends: [spend(100)] }, "network").total.metrics
    expect(m.cpl).toBeNull()
    expect(m.qualificationRate).toBeNull()
    expect(m.spend).toBe(100)
  })
})

describe("étapes cumulatives (historique des statuts)", () => {
  it("un dossier perdu après devis reste compté qualifié ET devis ; perdu après qualification reste qualifié", () => {
    const a = lead({ id: "a", status: "perdu" })
    const b = lead({ id: "b", status: "perdu" })
    const c = lead({ id: "c", status: "perdu" })
    const acts = [act("a", "qualifie"), act("a", "devis"), act("b", "qualifie")]
    const m = economics({ leads: [a, b, c], activities: acts, spends: [], commissions: [] }, "network").total.metrics
    expect(m).toMatchObject({ leads: 3, qualified: 2, quotes: 1, bookings: 0 })
  })

  it("un même dossier n'est compté qu'UNE fois par étape (qualifié → devis → réservé)", () => {
    const l = lead({ id: "a", status: "reserve", booked_at: "2026-11-08" })
    const acts = [act("a", "qualifie"), act("a", "devis"), act("a", "negociation"), act("a", "reserve")]
    const m = economics({ leads: [l], activities: acts, spends: [], commissions: [] }, "network").total.metrics
    expect(m).toMatchObject({ leads: 1, qualified: 1, quotes: 1, bookings: 1 })
  })

  it("réservation annulée (dossier repassé « perdu ») : plus comptée comme réservation, mais reste devis / qualifié", () => {
    const l = lead({ id: "a", status: "perdu" })
    const acts = [act("a", "qualifie"), act("a", "devis"), act("a", "reserve"), act("a", "perdu")]
    expect(economics({ leads: [l], activities: acts, spends: [], commissions: [] }, "network").total.metrics).toMatchObject({ bookings: 0, quotes: 1, qualified: 1 })
  })
})

describe("commissions : registre, annulations, provisoire / confirmé", () => {
  it("annulation et remboursement (lignes négatives) corrigent la commission nette", () => {
    const l = lead({ status: "reserve", booked_at: "2026-11-08" })
    const rows: CommissionRow[] = [com(l.id, 600), com(l.id, -600, { kind: "annulation" }), com(l.id, 600, { kind: "commission" }), com(l.id, -100, { kind: "remboursement" })]
    expect(economics({ leads: [l], activities: [], spends: [], commissions: rows }, "network").total.metrics.commissionNet).toBe(500)
  })

  it("provisoire et confirmé sont séparés ; la ligne est marquée « provisoire »", () => {
    const l = lead({ status: "reserve", booked_at: "2026-11-08" })
    const r = economics({ leads: [l], activities: [], spends: [spend(100)], commissions: [com(l.id, 300, { status: "confirme" }), com(l.id, 120.5, { status: "provisoire", kind: "commission" })] }, "network")
    expect(r.total.metrics).toMatchObject({ commissionConfirmed: 300, commissionProvisional: 120.5, commissionNet: 420.5 })
    expect(r.rows[0].hasProvisional).toBe(true)
  })

  it("commission d'un autre dossier : jamais attribuée à un lead absent de la sélection", () => {
    const l = lead({ id: "a", status: "reserve", booked_at: "2026-11-08" })
    const m = economics({ leads: [l], activities: [], spends: [], commissions: [com("autre-entreprise", 9999)] }, "network").total.metrics
    expect(m.commissionNet).toBe(0)
  })

  it("montants en millimes : aucune erreur d'arrondi flottant (0,1 + 0,2)", () => {
    const l = lead({ status: "reserve", booked_at: "2026-11-08" })
    const m = economics({ leads: [l], activities: [], spends: [spend(0.1), spend(0.2)], commissions: [] }, "network").total.metrics
    expect(m.spend).toBe(0.3)
  })
})

describe("dépenses : annulations et rattachement aux campagnes", () => {
  it("une écriture d'annulation (montant opposé) neutralise la dépense", () => {
    const m = economics({ ...empty, spends: [spend(250.5), spend(-250.5, { voids_id: 1 })] }, "network").total.metrics
    expect(m.spend).toBe(0)
  })

  it("nom de campagne normalisé : majuscules et espaces n'empêchent pas le rattachement", () => {
    expect(normalizeCampaign("  OMRA   2027 ")).toBe("omra 2027")
    const l = lead({ utm_campaign: "omra 2027", status: "reserve", booked_at: "2026-11-08" })
    const r = economics({ leads: [l], activities: [], spends: [spend(80, { campaign: "  Omra   2027 " })], commissions: [] }, "campaign")
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].metrics).toMatchObject({ spend: 80, leads: 1 })
    expect(r.unattachedSpend).toEqual([])
  })

  it("dépense dont la campagne n'a aucun lead : listée « non rattachée », comptée dans le total", () => {
    const r = economics({ leads: [lead()], activities: [], spends: [spend(80), spend(40, { campaign: "Faute de frappe" })], commissions: [] }, "campaign")
    expect(r.unattachedSpend).toEqual([{ network: "meta", campaign: "Faute de frappe", amount: 40 }])
    expect(r.total.metrics.spend).toBe(120)
  })

  it("même nom de campagne sur Meta et TikTok : deux lignes distinctes", () => {
    const leads = [lead({ channel: "meta" }), lead({ channel: "tiktok" })]
    const r = economics({ leads, activities: [], spends: [spend(100, { network: "meta" }), spend(60, { network: "tiktok" })], commissions: [] }, "campaign")
    expect(r.rows.map((x) => [x.label, x.metrics.spend]).sort()).toEqual([["Meta · Omra 2027", 100], ["TikTok · Omra 2027", 60]])
  })
})

describe("comparaisons", () => {
  const meta = lead({ id: "m", channel: "meta", status: "reserve", booked_at: "2026-11-08" })
  const tik = lead({ id: "t", channel: "tiktok", status: "reserve", booked_at: "2026-11-08" })
  const other = lead({ id: "o", channel: "whatsapp" })
  it("Meta contre TikTok contre autres canaux", () => {
    const r = economics({ leads: [meta, tik, other], activities: [], spends: [spend(100), spend(300, { network: "tiktok" })], commissions: [com("m", 500), com("t", 400)] }, "network")
    const by = Object.fromEntries(r.rows.map((x) => [x.key, x.metrics]))
    expect(by.meta).toMatchObject({ spend: 100, commissionNet: 500, result: 400, profitabilityPct: 500 })
    expect(by.tiktok).toMatchObject({ spend: 300, commissionNet: 400, result: 100 })
    expect(by.autre).toMatchObject({ leads: 1, spend: 0, profitabilityPct: null })
  })

  it("Omra contre voyages organisés : dépense répartie au prorata des leads, marquée « estimée » si la campagne mélange les produits", () => {
    const leads = [lead({ id: "1", product: "omra" }), lead({ id: "2", product: "omra" }), lead({ id: "3", product: "voyage" })]
    const r = economics({ leads, activities: [], spends: [spend(300)], commissions: [] }, "product")
    const by = Object.fromEntries(r.rows.map((x) => [x.key, x]))
    expect(by.omra.metrics.spend).toBe(200)
    expect(by.voyage.metrics.spend).toBe(100)
    expect(by.omra.spendBasis).toBe("estimee")
    expect(r.rows.reduce((a, x) => a + x.metrics.spend, 0)).toBe(300)
  })

  it("dépense exacte quand la campagne ne contient qu'un produit", () => {
    const r = economics({ leads: [lead({ product: "omra" })], activities: [], spends: [spend(90)], commissions: [] }, "product")
    expect(r.rows[0]).toMatchObject({ spendBasis: "exacte" })
    expect(r.rows[0].metrics.spend).toBe(90)
  })

  it("répartition sans reste perdu (100 TND sur 3 groupes égaux : la somme reste exacte)", () => {
    const leads = [lead({ niche: "a" }), lead({ niche: "b" }), lead({ niche: "c" })]
    const r = economics({ leads, activities: [], spends: [spend(100)], commissions: [] }, "niche")
    expect(r.rows.reduce((a, x) => a + x.metrics.spend, 0)).toBeCloseTo(100, 3)
  })

  it("annonce contre annonce (ad_id), à défaut utm_content", () => {
    const leads = [lead({ ad_id: "A1" }), lead({ ad_id: null, utm_content: "video-12" })]
    const keys = economics({ leads, activities: [], spends: [], commissions: [] }, "ad").rows.map((x) => x.key).sort()
    expect(keys).toEqual(["A1", "video-12"])
  })

  it("leadNetwork : meta, tiktok, sinon autre", () => {
    expect(leadNetwork("META")).toBe("meta")
    expect(leadNetwork("tiktok")).toBe("tiktok")
    expect(leadNetwork("whatsapp")).toBe("autre")
    expect(leadNetwork(null)).toBe("autre")
  })
})

describe("gagnante : réservations rentables, pas nombre de leads", () => {
  const bookedLead = (id: string, channel: string) => lead({ id, channel, status: "reserve", booked_at: "2026-11-08" })
  const many = (prefix: string, channel: string, k: number) => Array.from({ length: k }, (_, i) => bookedLead(`${prefix}${i}`, channel))

  it("la ligne qui produit le plus de leads n'est pas la gagnante : c'est celle au meilleur résultat", () => {
    // Meta : 12 leads (1 réservation faiblement rentable) ; TikTok : 5 réservations très rentables
    const metaLeads = [...many("m", "meta", 5), ...Array.from({ length: 7 }, () => lead({ channel: "meta" }))]
    const tikLeads = many("t", "tiktok", 5)
    const commissions = [...metaLeads.filter((x) => x.status === "reserve").map((x) => com(x.id, 40)), ...tikLeads.map((x) => com(x.id, 400))]
    const r = economics({ leads: [...metaLeads, ...tikLeads], activities: [], spends: [spend(150), spend(500, { network: "tiktok" })], commissions }, "network")
    expect(r.winnerKey).toBe("tiktok")
  })

  it("échantillon insuffisant (< 5 réservations) : aucune gagnante déclarée", () => {
    const l = bookedLead("a", "meta")
    const r = economics({ leads: [l], activities: [], spends: [spend(100)], commissions: [com("a", 900)] }, "network")
    expect(r.winnerKey).toBeNull()
    expect(r.winnerReason).toMatch(/au moins 5 réservations/)
    expect(r.rows[0].sufficient).toBe(false)
  })

  it("seuil réglable ; résultat négatif ou sans dépense : jamais gagnante", () => {
    const ls = many("m", "meta", 3)
    const ok = economics({ leads: ls, activities: [], spends: [spend(100)], commissions: ls.map((x) => com(x.id, 200)), minBookings: 3 }, "network")
    expect(ok.winnerKey).toBe("meta")
    const loss = economics({ leads: ls, activities: [], spends: [spend(1000)], commissions: ls.map((x) => com(x.id, 100)), minBookings: 3 }, "network")
    expect(loss.winnerKey).toBeNull()
    const free = economics({ leads: ls, activities: [], spends: [], commissions: ls.map((x) => com(x.id, 100)), minBookings: 3 }, "network")
    expect(free.winnerKey).toBeNull()
    expect(free.winnerReason).toMatch(/aucune dépense/i)
  })

  it("classement : résultat décroissant", () => {
    const a = bookedLead("a", "meta"); const b = bookedLead("b", "tiktok")
    const r = economics({ leads: [a, b], activities: [], spends: [spend(100), spend(100, { network: "tiktok" })], commissions: [com("a", 150), com("b", 900)] }, "network")
    expect(r.rows.map((x) => x.key)).toEqual(["tiktok", "meta"])
  })
})
