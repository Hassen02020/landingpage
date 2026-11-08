// Statistiques de l'espace équipe : marketing (campagne / groupe d'annonces / annonce) et équipe.
// Les agrégations sont des fonctions pures (testées) ; aucune donnée personnelle n'est lue.
import { select } from "./db"
import { STATUSES, isBooking, isUntreated, type Status } from "@/lib/status"

export interface Period {
  from: string // AAAA-MM-JJ (jour de Tunis, inclus)
  to: string // AAAA-MM-JJ (inclus)
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const tunisDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis" }).format(d)

export function parsePeriod(from?: string, to?: string, days = 30): Period {
  const today = tunisDay(new Date())
  const t = to && DAY.test(to) ? to : today
  const f = from && DAY.test(from) ? from : tunisDay(new Date(Date.now() - (days - 1) * 86_400_000))
  return f <= t ? { from: f, to: t } : { from: t, to: f }
}

// bornes UTC approximatives (Tunis = UTC+1, sans heure d'été)
export const periodFilter = (col: string, p: Period) =>
  `${col}=gte.${p.from}T00:00:00%2B01:00&${col}=lt.${nextDay(p.to)}T00:00:00%2B01:00`

function nextDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------- marketing
export interface LeadStatRow {
  status: Status
  booking_value: number | string | null
  channel: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_content: string | null
  campaign_id: string | null
  adset_id: string | null
  ad_id: string | null
  assigned_to: string | null
  product?: string | null
  offer?: string | null
}

export type Level = "campaign" | "adset" | "ad"

// Un chiffre par statut + regroupements lisibles. « Vendu » (booked) = réservé + gagné : un lead n'a qu'un statut
// et un seul montant, donc réservé → gagné ne compte jamais la vente deux fois.
export type Counts = Record<Status, number> & {
  leads: number
  revenue: number
  toTreat: number // nouveau + à contacter (aucun premier contact)
  inContact: number // contacté + à qualifier
  qualified: number // qualifié
  proposal: number // devis / proposition + en négociation
  booked: number // réservé + gagné
  lost: number
}

const empty = (): Counts => ({ ...(Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>), leads: 0, revenue: 0, toTreat: 0, inContact: 0, qualified: 0, proposal: 0, booked: 0, lost: 0 })

function add(c: Counts, r: LeadStatRow) {
  c.leads++
  c[r.status]++
  if (isUntreated(r.status)) c.toTreat++
  else if (r.status === "contacte" || r.status === "a_qualifier") c.inContact++
  else if (r.status === "qualifie") c.qualified++
  else if (r.status === "devis" || r.status === "negociation") c.proposal++
  else if (r.status === "perdu") c.lost++
  if (isBooking(r.status)) {
    c.booked++
    c.revenue += Number(r.booking_value) || 0
  }
}

export function rates(c: Counts) {
  const treated = c.leads - c.toTreat
  const closed = c.booked + c.lost
  return {
    treated,
    treatmentRate: c.leads ? treated / c.leads : 0, // leads traités / leads reçus
    bookingRate: c.leads ? c.booked / c.leads : 0, // ventes / leads reçus
    closingRate: closed ? c.booked / closed : 0, // ventes / dossiers conclus (vendu + perdu)
    avgBasket: c.booked ? c.revenue / c.booked : 0,
  }
}

export function totals(rows: LeadStatRow[]): Counts {
  const c = empty()
  rows.forEach((r) => add(c, r))
  return c
}

export interface GroupRow extends Counts {
  key: string
  channel: string
  source: string // utm_source · utm_medium (ex. instagram · bio) : distingue Facebook / Instagram dans le canal « meta »
  campaign: string
  adset: string
  ad: string
}

const label = (name: string | null, id: string | null) => name || (id ? `#${id}` : "(non renseigné)")

export function groupBy(rows: LeadStatRow[], level: Level): GroupRow[] {
  const map = new Map<string, GroupRow>()
  for (const r of rows) {
    const channel = r.channel || "direct"
    const source = [r.utm_source, r.utm_medium].filter(Boolean).join(" · ") || "—"
    const campaign = label(r.utm_campaign, r.campaign_id)
    const adset = level === "campaign" ? "" : label(r.utm_term, r.adset_id)
    const ad = level === "ad" ? label(r.utm_content, r.ad_id) : ""
    const key = [channel, source, campaign, adset, ad].join("\u0000")
    let g = map.get(key)
    if (!g) {
      g = { key, channel, source, campaign, adset, ad, ...empty() }
      map.set(key, g)
    }
    add(g, r)
  }
  return Array.from(map.values()).sort((a, b) => b.leads - a.leads || b.reserve - a.reserve)
}

export interface OfferRow extends Counts {
  key: string
  product: string
  offer: string
}

/** Par produit et offre (ex. Omra — « الفوج الثاني — 18 فيفري 2027 »). */
export function groupByOffer(rows: LeadStatRow[]): OfferRow[] {
  const map = new Map<string, OfferRow>()
  for (const r of rows) {
    const product = r.product || "autre"
    const offer = r.offer || "(offre non précisée)"
    const key = `${product}\u0000${offer}`
    let g = map.get(key)
    if (!g) {
      g = { key, product, offer, ...empty() }
      map.set(key, g)
    }
    add(g, r)
  }
  return Array.from(map.values()).sort((a, b) => b.leads - a.leads || b.reserve - a.reserve)
}

export async function loadLeadStats(p: Period): Promise<LeadStatRow[]> {
  return select<LeadStatRow>(
    "landing_leads",
    `select=status,booking_value,channel,utm_source,utm_medium,utm_campaign,utm_term,utm_content,campaign_id,adset_id,ad_id,assigned_to,product,offer&${periodFilter("created_at", p)}&limit=10000`
  )
}

// ---------------------------------------------------------------- équipe
export interface ActivityStatRow {
  actor_id: string | null
  type: string
  from_status?: Status | null
  to_status: Status | null
}

export interface StaffRow {
  user_id: string
  email: string
  full_name: string | null
  role: "admin" | "manager" | "agent"
  active: boolean
}

export interface MemberStats {
  userId: string
  name: string
  role: string
  active: boolean
  assigned: number
  actions: number
  notes: number
  contacted: number
  qualified: number
  proposals: number
  booked: number
  lost: number
  closingRate: number // ventes / (ventes + perdus) traités par ce membre
}

export function teamStats(staff: StaffRow[], activities: ActivityStatRow[], leads: LeadStatRow[]): MemberStats[] {
  return staff
    .map((s) => {
      const mine = activities.filter((a) => a.actor_id === s.user_id)
      const to = (st: Status) => mine.filter((a) => a.type === "status_change" && a.to_status === st).length
      // une vente = passage VERS réservé / gagné depuis une étape qui n'était pas déjà une vente (réservé → gagné ne recompte pas)
      const booked = mine.filter((a) => a.type === "status_change" && a.to_status && isBooking(a.to_status) && !(a.from_status && isBooking(a.from_status))).length
      const lost = to("perdu")
      return {
        userId: s.user_id,
        name: s.full_name || s.email,
        role: s.role,
        active: s.active,
        assigned: leads.filter((l) => l.assigned_to === s.user_id).length,
        actions: mine.length,
        notes: mine.filter((a) => a.type === "note").length,
        contacted: to("contacte"),
        qualified: to("qualifie"),
        proposals: to("devis"),
        booked,
        lost,
        closingRate: booked + lost ? booked / (booked + lost) : 0,
      }
    })
    .sort((a, b) => b.actions - a.actions)
}

export async function loadTeam(p: Period) {
  const [staff, activities, leads] = await Promise.all([
    select<StaffRow>("landing_staff", "select=user_id,email,full_name,role,active&order=email.asc"),
    select<ActivityStatRow>("landing_lead_activities", `select=actor_id,type,from_status,to_status&actor_id=not.is.null&${periodFilter("created_at", p)}&limit=20000`),
    loadLeadStats(p),
  ])
  return { staff, activities, leads }
}
