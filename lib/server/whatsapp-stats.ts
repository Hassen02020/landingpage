// Entonnoir WhatsApp : chaque étape garde sa NATURE (observé / saisi par l'équipe / calculé).
// Un clic prouve une intention, pas un message envoyé : sans API officielle, « envoyé » et « reçu » sont saisis.
import { select } from "./db"
import { isBooking } from "@/lib/status"
import { periodFilter, type Period } from "./stats"

export interface WaClick {
  visitor_ref: string | null
}
export interface WaLead {
  id: string
  source: string | null
  status: string
  visitor_ref: string | null
  booking_value: number | string | null
}
export interface WaActivity {
  lead_id: string
  type: string
}

export interface WaFunnel {
  clicks: number // observé : événements « Contact » (visiteurs ayant accepté les traceurs)
  visitorsClicked: number // observé : références distinctes
  formLeads: number // observé : demandes par formulaire
  whatsappLeads: number // saisi : leads créés par l'équipe depuis un message WhatsApp reçu
  attachedLeads: number // calculé : leads dont la référence correspond à un clic
  whatsappAttachedRate: number // part des leads WhatsApp saisis dont le clic d'origine est retrouvé
  messagesIn: number // saisi par l'équipe
  messagesOut: number // saisi par l'équipe
  conversations: number // calculé : leads ayant au moins un échange saisi
  reserved: number // leads réservés issus de WhatsApp (saisis, rattachés à un clic, ou avec échange)
  revenue: number
}

export function whatsappFunnel(clicks: WaClick[], leads: WaLead[], activities: WaActivity[]): WaFunnel {
  const clickRefs = new Set(clicks.map((c) => c.visitor_ref).filter((r): r is string => Boolean(r)))
  const wa = activities.filter((a) => a.type === "wa_in" || a.type === "wa_out")
  const convIds = new Set(wa.map((a) => a.lead_id))
  const whatsappLeads = leads.filter((l) => l.source === "whatsapp")
  const attached = leads.filter((l) => l.visitor_ref && clickRefs.has(l.visitor_ref))
  const related = leads.filter((l) => l.source === "whatsapp" || (l.visitor_ref && clickRefs.has(l.visitor_ref)) || convIds.has(l.id))
  const reserved = related.filter((l) => isBooking(l.status))
  return {
    clicks: clicks.length,
    visitorsClicked: clickRefs.size,
    formLeads: leads.filter((l) => l.source === "form").length,
    whatsappLeads: whatsappLeads.length,
    attachedLeads: attached.length,
    whatsappAttachedRate: whatsappLeads.length ? whatsappLeads.filter((l) => l.visitor_ref && clickRefs.has(l.visitor_ref)).length / whatsappLeads.length : 0,
    messagesIn: wa.filter((a) => a.type === "wa_in").length,
    messagesOut: wa.filter((a) => a.type === "wa_out").length,
    conversations: convIds.size,
    reserved: reserved.length,
    revenue: reserved.reduce((s, l) => s + (Number(l.booking_value) || 0), 0),
  }
}

export async function loadWhatsApp(p: Period) {
  const [clicks, leads, activities] = await Promise.all([
    select<WaClick>("landing_events", `select=visitor_ref&event_name=eq.Contact&${periodFilter("created_at", p)}&limit=50000`),
    select<WaLead>("landing_leads", `select=id,source,status,visitor_ref,booking_value&${periodFilter("created_at", p)}&limit=20000`),
    select<WaActivity>("landing_lead_activities", `select=lead_id,type&type=in.(wa_in,wa_out)&${periodFilter("created_at", p)}&limit=50000`).catch(() => []),
  ])
  return whatsappFunnel(clicks, leads, activities)
}
