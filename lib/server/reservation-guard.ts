// Contrôle « une réservation = une vente = un Purchase » : cherche d'autres dossiers du même client, même produit, même offre/départ,
// déjà réservés / gagnés ou portant un Purchase envoyé ou en attente (hors tests et hors doublons confirmés).
// Lecture seule. Lève une erreur si la base est illisible : l'appelant décide alors de RETENIR le Purchase (jamais d'envoi dans le doute).
import { runUnscopedLeads, select } from "@/lib/server/db"
import { selectRealLeads } from "@/lib/server/lead-scope"
import { findReservationConflicts, hasValidPhone, type ReservationConflict, type ReservationOther } from "@/lib/duplicates"

export interface GuardLead { id: string; phone: string | null; product: string; offer: string | null; offer_id?: string | null; travel_date?: string | null; created_at: string; status: string }

const COLS = "id,ref,phone,product,offer,offer_id,travel_date,created_at,status,assigned_to"

/** Dossiers pour lesquels un Purchase a déjà été journalisé (envoyé, en attente ou à relancer) — table absente (avant 0028) : aucun. */
async function purchaseLogged(leadIds: string[]): Promise<Set<string>> {
  if (!leadIds.length) return new Set()
  try {
    const rows = await select<{ lead_id: string | null }>("landing_conversion_log", `select=lead_id&event_name=eq.Purchase&status=in.(sent,pending,failed)&lead_id=in.(${leadIds.join(",")})&limit=200`)
    return new Set(rows.map((r) => r.lead_id).filter((x): x is string => !!x))
  } catch {
    return new Set()
  }
}

export async function reservationConflicts(lead: GuardLead): Promise<ReservationConflict[]> {
  if (!hasValidPhone(lead.phone)) return []
  // Contrôle interne : il doit voir les dossiers de TOUS les collègues (un employé ne voit que les siens ailleurs). Le résultat n'est
  // montré à un employé que sous forme neutre (voir crm.ts : ni montant, ni référence, ni nom d'un dossier qui ne lui est pas affecté).
  const others = await Promise.resolve(runUnscopedLeads(() => selectRealLeads<ReservationOther & { ref: string; assigned_to?: string | null }>(`select=${COLS}&phone=eq.${lead.phone}&id=neq.${lead.id}&limit=50`)))
  if (!others.length) return []
  const logged = await purchaseLogged(others.map((o) => o.id))
  return findReservationConflicts(lead as never, others.map((o) => ({ ...o, purchaseSentOrPending: logged.has(o.id) })))
}
