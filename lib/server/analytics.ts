// Analytics commerciales : entonnoir réel (étapes atteintes, y compris par les dossiers perdus), délai de premier
// traitement, séries par jour. Fonctions pures testées ; aucune donnée personnelle n'est lue.
import { select } from "./db"
import { STATUSES, isBooking, type Status } from "@/lib/status"
import { periodFilter, type Period } from "./stats"

export interface FunnelLead { id: string; created_at: string; status: Status; booking_value: number | string | null; booked_at: string | null }
export interface FunnelActivity { lead_id: string; type: string; to_status: Status | null; created_at: string; actor_id: string | null }

// ordre du pipeline (perdu n'a pas de rang : il garde l'étape la plus avancée atteinte avant la perte)
const RANK: Partial<Record<Status, number>> = Object.fromEntries(STATUSES.filter((s) => s !== "perdu").map((s, i) => [s, i]))

export const FUNNEL_STEPS: { key: string; label: string; min: Status }[] = [
  { key: "recus", label: "Leads reçus", min: "nouveau" },
  { key: "contactes", label: "Contactés", min: "contacte" },
  { key: "qualifies", label: "Qualifiés", min: "qualifie" },
  { key: "propositions", label: "Devis / proposition", min: "devis" },
  { key: "reserves", label: "Réservés", min: "reserve" },
  { key: "gagnes", label: "Gagnés", min: "gagne" },
]

/** Rang le plus avancé atteint : statut actuel + tous les statuts traversés (historique). */
export function maxRank(lead: FunnelLead, acts: FunnelActivity[]): number {
  let r = RANK[lead.status] ?? 0
  for (const a of acts) if (a.type === "status_change" && a.to_status) r = Math.max(r, RANK[a.to_status] ?? 0)
  return r
}

export interface FunnelStep { key: string; label: string; count: number; fromPrevious: number; fromStart: number }

export function funnel(leads: FunnelLead[], activities: FunnelActivity[]): FunnelStep[] {
  const by = new Map<string, FunnelActivity[]>()
  for (const a of activities) (by.get(a.lead_id) ?? by.set(a.lead_id, []).get(a.lead_id)!).push(a)
  const ranks = leads.map((l) => maxRank(l, by.get(l.id) ?? []))
  const counts = FUNNEL_STEPS.map((s) => ranks.filter((r) => r >= (RANK[s.min] ?? 0)).length)
  return FUNNEL_STEPS.map((s, i) => ({
    key: s.key, label: s.label, count: counts[i],
    fromPrevious: i === 0 ? 1 : counts[i - 1] ? counts[i] / counts[i - 1] : 0,
    fromStart: counts[0] ? counts[i] / counts[0] : 0,
  }))
}

export interface ResponseStats { treated: number; untreated: number; medianMinutes: number | null; avgMinutes: number | null; within1h: number; within24h: number }

const TREATMENT = new Set(["status_change", "note", "wa_out"])

/** Délai entre la création du lead et le premier acte d'un membre de l'équipe (statut, note, WhatsApp envoyé). */
export function responseTimes(leads: FunnelLead[], activities: FunnelActivity[]): ResponseStats {
  const first = new Map<string, number>()
  for (const a of activities) {
    if (!a.actor_id || !TREATMENT.has(a.type)) continue
    const t = Date.parse(a.created_at)
    if (!first.has(a.lead_id) || t < first.get(a.lead_id)!) first.set(a.lead_id, t)
  }
  const delays: number[] = []
  for (const l of leads) {
    const t = first.get(l.id)
    if (t === undefined) continue
    delays.push(Math.max(0, (t - Date.parse(l.created_at)) / 60_000))
  }
  delays.sort((a, b) => a - b)
  const mid = delays.length ? (delays.length % 2 ? delays[(delays.length - 1) / 2] : (delays[delays.length / 2 - 1] + delays[delays.length / 2]) / 2) : null
  return {
    treated: delays.length,
    untreated: leads.length - delays.length,
    medianMinutes: mid === null ? null : Math.round(mid),
    avgMinutes: delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null,
    within1h: delays.filter((d) => d <= 60).length,
    within24h: delays.filter((d) => d <= 1440).length,
  }
}

const tunisDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis" }).format(new Date(iso))

export interface DayPoint { day: string; leads: number; sales: number; revenue: number }

/** Série par jour : leads reçus (jour de création) et ventes (jour de la réservation, comptées une fois). */
export function dailySeries(leads: FunnelLead[], p: Period): DayPoint[] {
  const map = new Map<string, DayPoint>()
  const at = (day: string) => map.get(day) ?? map.set(day, { day, leads: 0, sales: 0, revenue: 0 }).get(day)!
  for (let d = new Date(`${p.from}T12:00:00Z`); d.toISOString().slice(0, 10) <= p.to; d.setUTCDate(d.getUTCDate() + 1)) at(d.toISOString().slice(0, 10))
  for (const l of leads) {
    const c = tunisDay(l.created_at)
    if (map.has(c)) at(c).leads++
    if (isBooking(l.status) && l.booked_at) {
      const b = tunisDay(l.booked_at)
      if (map.has(b)) { at(b).sales++; at(b).revenue += Number(l.booking_value) || 0 }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day))
}

export async function loadAnalytics(p: Period) {
  const leads = await select<FunnelLead>("landing_leads", `select=id,created_at,status,booking_value,booked_at&${periodFilter("created_at", p)}&limit=10000`)
  const ids = new Set(leads.map((l) => l.id))
  const raw = await select<FunnelActivity>("landing_lead_activities", `select=lead_id,type,to_status,created_at,actor_id&${periodFilter("created_at", { from: p.from, to: "9999-12-30" })}&limit=50000`)
  const activities = raw.filter((a) => ids.has(a.lead_id))
  return { leads, activities, funnel: funnel(leads, activities), response: responseTimes(leads, activities), series: dailySeries(leads, p) }
}
