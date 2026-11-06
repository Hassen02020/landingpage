// Chiffres du jour pour l'accueil de /admin (cartes cliquables vers les listes filtrées).
import { select } from "./db"
import { tunisDay } from "./crm"
import { BOOKING_STATUSES, OPEN_STATUSES, inFilter, isUntreated } from "@/lib/status"

export interface Dashboard {
  toTreat: number // nouveaux, jamais traités
  today: number // reçus aujourd'hui
  overdue: number // relances échues (dossiers ouverts)
  mine: number // mes dossiers ouverts
  unassigned: number // dossiers ouverts sans responsable
  bookedMonth: number
  revenueMonth: number
}

const OPEN = `status=${inFilter(OPEN_STATUSES)}`

export async function loadDashboard(userId: string): Promise<Dashboard> {
  const monthStart = `${tunisDay().slice(0, 8)}01`
  const [open, booked, today] = await Promise.all([
    select<{ status: string; next_follow_up_at: string | null; assigned_to: string | null }>("landing_leads", `select=status,next_follow_up_at,assigned_to&${OPEN}&anonymized_at=is.null&limit=20000`),
    select<{ booking_value: number | string | null }>("landing_leads", `select=booking_value&status=${inFilter(BOOKING_STATUSES)}&booked_at=gte.${monthStart}T00:00:00%2B01:00&limit=20000`),
    select<{ id: string }>("landing_leads", `select=id&lead_day=eq.${tunisDay()}&limit=20000`),
  ])
  const now = Date.now()
  return {
    toTreat: open.filter((l) => isUntreated(l.status)).length,
    today: today.length,
    overdue: open.filter((l) => l.next_follow_up_at && Date.parse(l.next_follow_up_at) <= now).length,
    mine: open.filter((l) => l.assigned_to === userId).length,
    unassigned: open.filter((l) => !l.assigned_to).length,
    bookedMonth: booked.length,
    revenueMonth: booked.reduce((a, l) => a + (Number(l.booking_value) || 0), 0),
  }
}
