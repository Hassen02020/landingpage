// Intelligence Center, Phase 1 : états « données insuffisantes », qualité des données, alertes, menu par rôle.
// Jeux de données FICTIFS (tests).
import { describe, expect, it } from "vitest"
import { MIN_BOOKINGS, overviewAlerts, qualityReport, sampleState, type QualityLead } from "@/lib/intelligence"
import { NAV_GROUPS, visibleGroups } from "@/lib/admin-nav"

const NOW = Date.parse("2026-11-20T12:00:00Z")
let n = 0
const lead = (o: Partial<QualityLead> = {}): QualityLead => ({ id: `L${++n}`, created_at: "2026-11-19T08:00:00Z", status: "contacte", channel: "meta", utm_campaign: "omra-ramadan-2027-fb", region: "Tunis", tracking_consent: true, ...o })
const issue = (r: ReturnType<typeof qualityReport>, key: string) => r.issues.find((i) => i.key === key)

describe("sampleState : données insuffisantes", () => {
  it("signale l'effectif, le minimum et ne cache jamais un petit échantillon", () => {
    expect(sampleState(2, 5, "réservation(s)")).toMatchObject({ enough: false, n: 2, min: 5, message: "Données insuffisantes : 2 réservation(s), 5 minimum pour comparer." })
    expect(sampleState(5, 5, "réservation(s)")).toMatchObject({ enough: true, message: "" })
  })
  it("valeurs absurdes (NaN, négatif) : 0, jamais une erreur", () => {
    expect(sampleState(NaN, 5, "x").n).toBe(0)
    expect(sampleState(-3, 5, "x").enough).toBe(false)
  })
  it("le seuil de la vue d'ensemble est celui de la rentabilité (5)", () => { expect(MIN_BOOKINGS).toBe(5) })
})

describe("qualityReport : ce qui fausse les analyses", () => {
  it("compte chaque anomalie sur la bonne population", () => {
    const leads = [
      lead({ region: null }),
      lead({ channel: "meta", utm_campaign: null }),
      lead({ channel: "meta", utm_campaign: "Omra Ramadan 2027" }), // hors convention
      lead({ tracking_consent: false }),
      lead({ status: "nouveau", created_at: "2026-11-18T08:00:00Z" }), // non traité > 24 h
      lead({ status: "nouveau", created_at: "2026-11-20T11:00:00Z" }), // non traité mais récent
      lead(),
    ]
    const r = qualityReport(leads, { now: NOW })
    expect(r.total).toBe(7)
    expect(issue(r, "region_missing")?.count).toBe(1)
    expect(issue(r, "meta_without_campaign")?.count).toBe(1)
    expect(issue(r, "campaign_off_convention")?.count).toBe(1)
    expect(issue(r, "no_tracking_consent")?.count).toBe(1)
    expect(issue(r, "untreated")?.count).toBe(1)
  })

  it("aucune anomalie : aucune ligne (pas de faux problème)", () => {
    const r = qualityReport([lead(), lead()], { now: NOW, bookingsWithoutCommission: 0 })
    expect(r.issues).toEqual([])
  })

  it("les anomalies critiques passent avant les avertissements, puis les informations", () => {
    const r = qualityReport([lead({ region: null }), lead({ utm_campaign: null }), lead({ status: "nouveau", created_at: "2026-11-01T08:00:00Z" })], { now: NOW })
    expect(r.issues.map((i) => i.severity)).toEqual(["critical", "warn", "info"])
  })

  it("réservations sans commission : calculées seulement avec le droit financier, sinon listées comme NON DISPONIBLES (jamais 0)", () => {
    const sans = qualityReport([lead()], { now: NOW })
    expect(issue(sans, "bookings_without_commission")).toBeUndefined()
    expect(sans.unavailable.map((u) => u.key)).toContain("bookings_without_commission")
    const avec = qualityReport([lead()], { now: NOW, bookingsWithoutCommission: 3 })
    expect(issue(avec, "bookings_without_commission")).toMatchObject({ count: 3, severity: "critical" })
    expect(avec.unavailable.map((u) => u.key)).not.toContain("bookings_without_commission")
  })

  it("avant la migration de gouvernance : contrôles de test / motif de perte déclarés indisponibles", () => {
    const r = qualityReport([lead({ status: "perdu" })], { now: NOW })
    expect(r.unavailable.map((u) => u.key)).toContain("governance")
    expect(issue(r, "lost_without_reason")).toBeUndefined()
  })

  it("après la migration : leads de test exclus des contrôles et comptés à part ; pertes sans motif et ventes sans produit signalées", () => {
    const leads = [
      lead({ is_test: true, status: "nouveau", created_at: "2026-11-01T08:00:00Z" }), // test : ne compte pas comme « non traité »
      lead({ status: "perdu", lost_reason: null }),
      lead({ status: "perdu", lost_reason: "prix" }),
      lead({ status: "reserve", purchased_product: null }),
      lead({ status: "gagne", purchased_product: "omra" }),
    ]
    const r = qualityReport(leads, { now: NOW, governanceColumns: true })
    expect(r.total).toBe(4)
    expect(r.excludedTests).toBe(1)
    expect(issue(r, "untreated")).toBeUndefined()
    expect(issue(r, "lost_without_reason")?.count).toBe(1)
    expect(issue(r, "booked_without_product")?.count).toBe(1)
    expect(r.unavailable.map((u) => u.key)).not.toContain("governance")
  })

  it("ne contient AUCUNE donnée personnelle (comptages et libellés seulement)", () => {
    const r = qualityReport([lead({ id: "secret-id-123", region: null })], { now: NOW })
    expect(JSON.stringify(r)).not.toMatch(/secret-id-123/)
  })
})

describe("overviewAlerts : alertes issues des seuls chiffres de la période", () => {
  const base = { leads: 10, qualified: 4, bookings: 2, spend: 100, marginConfirmed: 0, unattachedSpendCount: 0, untreated: 0 }
  it("0 réservation : aucune conclusion de rentabilité", () => {
    const a = overviewAlerts({ ...base, bookings: 0 })
    expect(a.map((x) => x.key)).toEqual(["no_bookings"])
    expect(a[0].text).toMatch(/0 réservation sur 10/)
    expect(a[0].text).toMatch(/5 réservations confirmées minimum/)
  })
  it("rien à signaler : aucune alerte", () => { expect(overviewAlerts(base)).toEqual([]) })
  it("dépense sans lead, dépense non rattachée, leads non traités", () => {
    const keys = (i: Partial<typeof base>) => overviewAlerts({ ...base, ...i }).map((x) => x.key)
    expect(keys({ leads: 0, bookings: 0 })).toEqual(["no_leads", "spend_without_leads"])
    expect(keys({ unattachedSpendCount: 2 })).toContain("unattached_spend")
    expect(keys({ untreated: 3 })).toContain("untreated")
  })
  it("sans droit financier (dépense null) : aucune alerte financière, jamais « 0 » inventé", () => {
    const a = overviewAlerts({ ...base, leads: 0, bookings: 0, spend: null })
    expect(a.map((x) => x.key)).toEqual(["no_leads"])
  })
})

describe("menu Intelligence : droits par rôle inchangés, aucune entrée dupliquée", () => {
  const labels = (role: Parameters<typeof visibleGroups>[0]) => visibleGroups(role).flatMap((g) => g.items.map((i) => `${g.title}/${i.label}`))
  it("le groupe « Analyse » devient « Intelligence » et garde ses pages existantes", () => {
    const titles = NAV_GROUPS.map((g) => g.title)
    expect(titles).toEqual(["Leads", "Intelligence", "Catalogue", "Réglages"])
    const intel = NAV_GROUPS.find((g) => g.title === "Intelligence")!.items.map((i) => i.href)
    for (const h of ["/admin/stats", "/admin/segments", "/admin/rentabilite", "/admin/liens", "/admin/calculateur"]) expect(intel).toContain(h)
  })
  it("employé : ne voit ni la vue d'ensemble, ni la qualité des données, ni la rentabilité ; garde Statistiques et Segments (comme avant)", () => {
    const l = labels("employee")
    expect(l).not.toContain("Intelligence/Vue d'ensemble")
    expect(l).not.toContain("Intelligence/Qualité des données")
    expect(l).not.toContain("Intelligence/Rentabilité")
    expect(l).toContain("Intelligence/Statistiques")
    expect(l).toContain("Intelligence/Segments")
  })
  it("manager et administrateur : voient la vue d'ensemble, la qualité des données et la rentabilité", () => {
    for (const role of ["manager", "admin"] as const) {
      const l = labels(role)
      for (const x of ["Intelligence/Vue d'ensemble", "Intelligence/Qualité des données", "Intelligence/Rentabilité"]) expect(l).toContain(x)
    }
  })
  it("aucun rôle absent ou inconnu ne voit les pages protégées", () => {
    expect(labels(null)).not.toContain("Intelligence/Vue d'ensemble")
    expect(labels("pirate" as never)).not.toContain("Intelligence/Qualité des données")
  })
  it("aucune adresse n'apparaît deux fois dans le menu", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href))
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})
