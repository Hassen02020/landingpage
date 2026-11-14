// Journal des événements entrants (migration 0023) : chaque événement reçu d'un canal externe et son ISSUE.
// Aucune donnée personnelle : plateforme, identifiant externe, page / numéro, état, code de raison.
// Écriture TOLÉRANTE : le journal ne doit jamais empêcher (ni faire échouer) l'enregistrement d'un lead ;
// si la table n'existe pas encore (migration non appliquée), rien n'est écrit et aucune erreur ne remonte.
import { DbError, insertQuiet, runWithOrg, select } from "@/lib/server/db"
import { isOrgId } from "@/lib/org-id"
import type { InboundPlatform } from "@/lib/server/inbound-leads"

export type InboundStatus = "created" | "duplicate" | "ignored" | "dropped" | "retry"

export const INBOUND_STATUS_LABEL: Record<InboundStatus, string> = {
  created: "Lead créé",
  duplicate: "Doublon (déjà reçu)",
  ignored: "Ignoré",
  dropped: "Abandonné",
  retry: "À rejouer",
}

export interface InboundEventInput {
  platform: InboundPlatform
  externalId: string
  /** identifiant de page ou de numéro (jamais un jeton) */
  sourceRef?: string
  status: InboundStatus
  /** code court, sans donnée personnelle (ex. « page_disabled », « token_invalid », « graph_190 ») */
  reason?: string
}

const missing = (e: unknown) => e instanceof DbError && (e.code === "42P01" || e.code === "PGRST205" || e.status === 404)
const clean = (v: string | undefined, max: number) => (v ? v.replace(/[^\w.:=\-]/g, "").slice(0, max) : undefined)

/** Enregistre l'issue d'un événement. Ne lève jamais d'erreur. */
export async function recordInboundEvent(orgId: string, e: InboundEventInput): Promise<void> {
  if (!isOrgId(orgId)) return
  const externalId = clean(e.externalId, 100)
  if (!externalId) return
  try {
    await runWithOrg(orgId, () =>
      insertQuiet("landing_inbound_events", {
        platform: e.platform,
        external_id: externalId,
        source_ref: clean(e.sourceRef, 40) ?? null,
        status: e.status,
        reason: clean(e.reason, 120) ?? null,
      })
    )
  } catch (err) {
    if (!missing(err)) console.error("[inbound-events] journal non écrit", err instanceof Error ? err.message : "erreur")
  }
}

export interface InboundEventRow {
  id: number
  platform: InboundPlatform
  external_id: string
  source_ref: string | null
  status: InboundStatus
  reason: string | null
  created_at: string
}

export interface ChannelHealth {
  platform: InboundPlatform
  lastAt: string | null
  created: number
  duplicate: number
  ignored: number
  dropped: number
  retry: number
}

const PLATFORMS: InboundPlatform[] = ["facebook", "instagram", "tiktok", "whatsapp"]

/** Derniers événements + santé par canal sur 7 jours. `tableMissing` = migration 0023 non appliquée. */
export async function loadInboundJournal(orgId: string, limit = 30): Promise<{ events: InboundEventRow[]; health: ChannelHealth[]; tableMissing: boolean }> {
  const empty: ChannelHealth[] = PLATFORMS.map((p) => ({ platform: p, lastAt: null, created: 0, duplicate: 0, ignored: 0, dropped: 0, retry: 0 }))
  if (!isOrgId(orgId)) return { events: [], health: empty, tableMissing: false }
  try {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const [events, recent] = await runWithOrg(orgId, () =>
      Promise.all([
        select<InboundEventRow>("landing_inbound_events", `select=id,platform,external_id,source_ref,status,reason,created_at&order=id.desc&limit=${Math.min(Math.max(limit, 1), 100)}`),
        select<Pick<InboundEventRow, "platform" | "status" | "created_at">>("landing_inbound_events", `select=platform,status,created_at&created_at=gte.${encodeURIComponent(since)}&order=id.desc&limit=5000`),
      ])
    )
    const health = empty.map((h) => ({ ...h }))
    for (const r of recent) {
      const h = health.find((x) => x.platform === r.platform)
      if (!h) continue
      h[r.status] += 1
      if (!h.lastAt || r.created_at > h.lastAt) h.lastAt = r.created_at
    }
    return { events, health, tableMissing: false }
  } catch (err) {
    if (missing(err)) return { events: [], health: empty, tableMissing: true }
    console.error("[inbound-events] lecture impossible", err instanceof Error ? err.message : "erreur")
    return { events: [], health: empty, tableMissing: false }
  }
}
