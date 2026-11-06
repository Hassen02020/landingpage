// Customer 360 : vue unifiée d'un client = tous ses leads (même téléphone) + chronologie commune.
// Aucune table « clients » : le téléphone normalisé est la clé. Fonctions pures testées + chargeurs en lecture seule.
import { select } from "./db"
import { isBooking, isOpen, type Status } from "@/lib/status"
import type { Activity, LeadRow } from "./crm"
import { tierOf, type Tier } from "@/lib/loyalty"

export const PHONE_KEY_RE = /^\d{8,15}$/

export interface CustomerSummary {
  phone: string
  name: string
  leads: number
  openLeads: number
  booked: number // réservé + gagné
  revenue: number
  lastActivityAt: string
  firstSeenAt: string
  products: string[]
  channels: string[]
  region: string | null
  marketingOk: boolean // vrai seulement si AUCUN lead n'a retiré / refusé le consentement
  lastStatus: Status
  tier: Tier // fidélité : cumul à vie du chiffre d'affaires (lib/loyalty.ts)
}

const pickName = (l: Pick<LeadRow, "first_name" | "last_name">) => [l.first_name, l.last_name].filter(Boolean).join(" ")

/** Regroupe des leads par téléphone. Les leads sans téléphone (anonymisés) ne forment pas de client. */
export function groupCustomers(leads: LeadRow[]): CustomerSummary[] {
  const map = new Map<string, LeadRow[]>()
  for (const l of leads) {
    if (!l.phone || !PHONE_KEY_RE.test(l.phone) || l.anonymized_at) continue
    const arr = map.get(l.phone) ?? []
    arr.push(l)
    map.set(l.phone, arr)
  }
  return Array.from(map.entries())
    .map(([phone, ls]) => {
      const sorted = [...ls].sort((a, b) => b.created_at.localeCompare(a.created_at))
      const latest = sorted[0]
      const booked = ls.filter((l) => isBooking(l.status))
      return {
        phone,
        name: pickName(latest),
        leads: ls.length,
        openLeads: ls.filter((l) => isOpen(l.status)).length,
        booked: booked.length,
        revenue: booked.reduce((a, l) => a + (Number(l.booking_value) || 0), 0),
        lastActivityAt: ls.map((l) => l.updated_at || l.created_at).sort().at(-1)!,
        firstSeenAt: sorted.at(-1)!.created_at,
        products: Array.from(new Set(ls.map((l) => l.product))),
        channels: Array.from(new Set(ls.map((l) => l.channel || "direct"))),
        region: sorted.find((l) => l.region)?.region ?? null,
        marketingOk: ls.every((l) => l.marketing_consent && !l.marketing_withdrawn_at),
        lastStatus: latest.status,
        tier: tierOf(booked.length, booked.reduce((a, l) => a + (Number(l.booking_value) || 0), 0)),
      }
    })
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
}

export interface TimelineItem extends Activity {
  lead_id: string
  lead_ref: string
}

/** Chronologie commune (récent → ancien) : les activités de tous les leads du client. */
export function mergeTimeline(leads: Pick<LeadRow, "id" | "ref">[], activities: (Activity & { lead_id: string })[]): TimelineItem[] {
  const ref = new Map(leads.map((l) => [l.id, l.ref]))
  return activities
    .filter((a) => ref.has(a.lead_id))
    .map((a) => ({ ...a, lead_ref: ref.get(a.lead_id)! }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
}

export interface CustomerProfile {
  phone: string
  name: string
  email: string | null
  region: string | null
  leads: LeadRow[]
  summary: CustomerSummary
  consents: { contact: boolean; marketing: boolean; marketingWithdrawnAt: string | null; tracking: boolean }
  timeline: TimelineItem[]
  whatsapp: { received: number; sent: number }
}

/** Profil à partir des leads (récents d'abord) et de leurs activités. Email / région : la valeur la plus récente renseignée. */
export function buildProfile(phone: string, leads: LeadRow[], activities: (Activity & { lead_id: string })[]): CustomerProfile | null {
  const mine = leads.filter((l) => l.phone === phone && !l.anonymized_at).sort((a, b) => b.created_at.localeCompare(a.created_at))
  if (!mine.length) return null
  const summary = groupCustomers(mine)[0]
  const timeline = mergeTimeline(mine, activities)
  return {
    phone,
    name: summary.name,
    email: mine.find((l) => l.email)?.email ?? null,
    region: mine.find((l) => l.region)?.region ?? null,
    leads: mine,
    summary,
    consents: {
      contact: true, // obligatoire pour enregistrer un lead (contrainte en base)
      marketing: summary.marketingOk,
      marketingWithdrawnAt: mine.map((l) => l.marketing_withdrawn_at).filter(Boolean).sort().at(-1) ?? null,
      tracking: mine.some((l) => l.tracking_consent),
    },
    timeline,
    whatsapp: { received: timeline.filter((t) => t.type === "wa_in").length, sent: timeline.filter((t) => t.type === "wa_out").length },
  }
}

// ---------------------------------------------------------------- chargeurs (lecture seule)
export async function listCustomers(term: string | undefined, page = 0, pageSize = 50): Promise<CustomerSummary[]> {
  const q = ["select=*", "order=created_at.desc", "limit=5000", "phone=not.is.null"]
  const t = (term || "").trim()
  if (t) {
    if (/^[+\d\s]{4,20}$/.test(t)) q.push(`phone=like.*${t.replace(/\D/g, "")}*`)
    else if (/^[A-Za-zÀ-ÿ؀-ۿ\s'-]{2,40}$/.test(t)) q.push(`or=(first_name.ilike.*${encodeURIComponent(t)}*,last_name.ilike.*${encodeURIComponent(t)}*)`)
    else return []
  }
  const leads = await select<LeadRow>("landing_leads", q.join("&"))
  return groupCustomers(leads).slice(page * pageSize, (page + 1) * pageSize)
}

/** Tous les clients (jusqu'à 5 000 demandes récentes), pour la segmentation. Lecture seule. */
export async function loadAllCustomers(): Promise<CustomerSummary[]> {
  const leads = await select<LeadRow>("landing_leads", "select=*&order=created_at.desc&limit=5000&phone=not.is.null")
  return groupCustomers(leads)
}

export async function loadCustomer(phone: string): Promise<CustomerProfile | null> {
  if (!PHONE_KEY_RE.test(phone)) return null
  const leads = await select<LeadRow>("landing_leads", `select=*&phone=eq.${phone}&order=created_at.desc&limit=200`)
  if (!leads.length) return null
  const ids = leads.map((l) => l.id).join(",")
  const activities = await select<Activity & { lead_id: string }>(
    "landing_lead_activities",
    `select=id,lead_id,created_at,actor_label,type,from_status,to_status,body&lead_id=in.(${ids})&order=created_at.desc&limit=500`
  )
  return buildProfile(phone, leads, activities)
}
