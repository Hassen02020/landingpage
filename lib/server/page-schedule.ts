// PUBLICATION PROGRAMMÉE (colonnes publish_at / unpublish_at de landing_categories — migration 0021, fichier local NON appliqué).
// La base ne publie rien toute seule : ce module APPLIQUE les programmations échues en passant par publishPage / unpublishPage, donc avec exactement
// les mêmes contrôles de complétude que la publication manuelle. TANT QUE LES COLONNES N'EXISTENT PAS : lecture « indisponible », programmation refusée
// avec un message clair, exécution sans effet ; jamais d'exception ni de page publiée par erreur.
import { DbError, select, update } from "@/lib/server/db"
import { getCategory } from "@/lib/server/catalog"
import { loadBuilderPage, publishPage, unpublishPage } from "@/lib/server/page-builder"
import { ARCHIVED_POSITION } from "@/lib/page-builder/dashboard"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MIN_LEAD_MS = 60_000
export const MAX_AHEAD_MS = 366 * 86_400_000

export interface Schedule { publishAt: string | null; unpublishAt: string | null }
const none: Schedule = { publishAt: null, unpublishAt: null }
export const isMissingScheduleColumn = (e: unknown): boolean => e instanceof DbError && (e.code === "42703" || e.code === "PGRST204" || (e.status === 400 && /(publish_at|unpublish_at)/i.test(e.message)))

/** « AAAA-MM-JJTHH:MM » saisi dans l'interface = heure de TUNIS (UTC+1, sans heure d'été) → instant UTC, ou null si invalide. */
export function parseTunisLocal(v: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec((v ?? "").trim())
  if (!m) return null
  const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+01:00`)
  if (Number.isNaN(t)) return null
  const back = new Date(t + 3_600_000).toISOString() // relecture : refuse le 31 février, l'heure 25, etc.
  return back.startsWith(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`) ? t : null
}
/** Instant UTC → valeur « AAAA-MM-JJTHH:MM » en heure de Tunis (pour pré-remplir le champ). */
export const toTunisLocal = (iso: string | null): string => (iso ? new Date(Date.parse(iso) + 3_600_000).toISOString().slice(0, 16) : "")

export async function listSchedules(): Promise<{ available: boolean; byId: Record<string, Schedule> }> {
  try {
    const [a, b] = await Promise.all([
      select<{ id: string; publish_at: string | null; unpublish_at: string | null }>("landing_categories", "select=id,publish_at,unpublish_at&publish_at=not.is.null&limit=200"),
      select<{ id: string; publish_at: string | null; unpublish_at: string | null }>("landing_categories", "select=id,publish_at,unpublish_at&unpublish_at=not.is.null&limit=200"),
    ])
    const byId: Record<string, Schedule> = {}
    for (const r of [...a, ...b]) byId[r.id] = { publishAt: r.publish_at, unpublishAt: r.unpublish_at }
    return { available: true, byId }
  } catch (e) {
    if (isMissingScheduleColumn(e)) return { available: false, byId: {} }
    throw e
  }
}

export async function loadSchedule(id: string): Promise<{ available: boolean; schedule: Schedule }> {
  if (!UUID.test(id)) return { available: false, schedule: none }
  try {
    const [r] = await select<{ publish_at: string | null; unpublish_at: string | null }>("landing_categories", `select=publish_at,unpublish_at&id=eq.${id}&limit=1`)
    return { available: true, schedule: { publishAt: r?.publish_at ?? null, unpublishAt: r?.unpublish_at ?? null } }
  } catch (e) {
    if (isMissingScheduleColumn(e)) return { available: false, schedule: none }
    throw e
  }
}

export type ScheduleResult = { ok: true } | { ok: false; message: string }

export async function setSchedule(id: string, input: { publishAt?: string; unpublishAt?: string }, actorId: string | null, now = Date.now()): Promise<ScheduleResult> {
  const page = await loadBuilderPage(id)
  if (!page) return { ok: false, message: "Page introuvable." }
  if (!page.category.visible && page.category.position <= ARCHIVED_POSITION) return { ok: false, message: "Une page archivée ne peut pas être programmée : restaurez-la d'abord." }
  const pub = (input.publishAt ?? "").trim() ? parseTunisLocal(input.publishAt) : null
  const unpub = (input.unpublishAt ?? "").trim() ? parseTunisLocal(input.unpublishAt) : null
  if ((input.publishAt ?? "").trim() && pub === null) return { ok: false, message: "Date de publication invalide (jour et heure attendus)." }
  if ((input.unpublishAt ?? "").trim() && unpub === null) return { ok: false, message: "Date de masquage invalide (jour et heure attendus)." }
  if (pub === null && unpub === null) return { ok: false, message: "Indiquez au moins une date." }
  for (const [t, label] of [[pub, "de publication"], [unpub, "de masquage"]] as const) {
    if (t !== null && t < now + MIN_LEAD_MS) return { ok: false, message: `La date ${label} doit être dans le futur (au moins une minute).` }
    if (t !== null && t > now + MAX_AHEAD_MS) return { ok: false, message: `La date ${label} doit être dans l'année à venir.` }
  }
  if (pub !== null) {
    if (page.category.visible) return { ok: false, message: "Cette page est déjà publiée : programmez seulement son masquage." }
    // MÊMES contrôles que la publication manuelle : une page incomplète ne se programme pas
    if (!page.readiness.ready) return { ok: false, message: "La page est incomplète : corrigez les points signalés (étape Aperçu) avant de la programmer." }
  }
  if (pub !== null && unpub !== null && unpub <= pub) return { ok: false, message: "Le masquage doit être après la publication." }
  if (unpub !== null && pub === null && !page.category.visible) return { ok: false, message: "Cette page est masquée : programmez d'abord sa publication." }
  try {
    await update("landing_categories", `id=eq.${id}`, { publish_at: pub === null ? null : new Date(pub).toISOString(), unpublish_at: unpub === null ? null : new Date(unpub).toISOString(), updated_at: new Date().toISOString(), updated_by: actorId })
    return { ok: true }
  } catch (e) {
    if (isMissingScheduleColumn(e)) return { ok: false, message: "La publication programmée nécessite la migration 0021 (fichier prêt, à appliquer par le propriétaire) : rien n'a été enregistré." }
    if (e instanceof DbError && (e.code === "23514" || e.status === 409)) return { ok: false, message: "Le masquage doit être après la publication." }
    throw e
  }
}

export async function clearSchedule(id: string, actorId: string | null): Promise<ScheduleResult> {
  const page = await getCategory(id)
  if (!page) return { ok: false, message: "Page introuvable." }
  try {
    await update("landing_categories", `id=eq.${id}`, { publish_at: null, unpublish_at: null, updated_at: new Date().toISOString(), updated_by: actorId })
    return { ok: true }
  } catch (e) {
    if (isMissingScheduleColumn(e)) return { ok: false, message: "La publication programmée nécessite la migration 0021." }
    throw e
  }
}

export interface RunReport { available: boolean; published: number; unpublished: number; cleared: number; blocked: { id: string; reason: string }[] }

/** Applique les programmations ÉCHUES de l'entreprise du contexte. Idempotent : relançable à tout moment sans double effet. */
export async function runDueSchedules(now = Date.now()): Promise<RunReport> {
  const report: RunReport = { available: true, published: 0, unpublished: 0, cleared: 0, blocked: [] }
  const { available, byId } = await listSchedules()
  if (!available) return { ...report, available: false }
  for (const id of Object.keys(byId)) {
    const s = byId[id]
    const pubDue = s.publishAt !== null && Date.parse(s.publishAt) <= now
    const unpubDue = s.unpublishAt !== null && Date.parse(s.unpublishAt) <= now
    if (!pubDue && !unpubDue) continue
    const page = await getCategory(id)
    if (!page) continue
    const clear = async (cols: Record<string, null>) => { await update("landing_categories", `id=eq.${id}`, { ...cols, updated_at: new Date().toISOString() }); report.cleared++ }
    // fenêtre entièrement passée (publication ET masquage échus pendant que rien ne tournait) : on ne publie pas une page pour la masquer aussitôt
    if (pubDue && unpubDue) { await clear({ publish_at: null, unpublish_at: null }); continue }
    if (pubDue) {
      if (page.visible) { await clear({ publish_at: null }); continue }
      const r = await publishPage(id, null, null)
      if (r.ok) { report.published++; await update("landing_categories", `id=eq.${id}`, { publish_at: null }) }
      else report.blocked.push({ id, reason: r.message }) // incomplète (ex. offres expirées) : la programmation reste, l'équipe est prévenue à l'écran
      continue
    }
    if (unpubDue) {
      if (page.visible) { const r = await unpublishPage(id, null); if (r.ok) report.unpublished++ }
      await update("landing_categories", `id=eq.${id}`, { unpublish_at: null })
    }
  }
  return report
}
