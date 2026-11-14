// Avis en étoiles des visiteurs (table landing_reviews, migration 0025).
// Règles : tout visiteur peut déposer un avis ; AUCUN avis n'est visible avant validation par l'équipe ; la moyenne et le nombre
// ne portent que sur les avis PUBLIÉS ; aucun e-mail, téléphone ni IP n'est conservé ; le texte est brut (React l'échappe).
import { DbError, insertOne, select, update } from "@/lib/server/db"
import { sha256 } from "@/lib/server/hash"

/** Pages qui acceptent des avis. */
export const REVIEW_PAGES: ReadonlySet<string> = new Set(["omra"])
export type ReviewStatus = "pending" | "published" | "rejected"
export type ReviewLang = "fr" | "ar" | "en"

export interface ReviewInput {
  page: string
  rating: unknown
  name: unknown
  comment?: unknown
  consent: unknown
  lang?: unknown
  /** champ piège : un robot le remplit, pas un visiteur */
  website?: unknown
}

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "invalid"; errors: Record<string, string> }
  | { ok: false; reason: "rate" }
  | { ok: false; reason: "unavailable" }

export interface PublicReview { rating: number; name: string; comment: string | null; created_at: string }
export interface PublishedReviews { count: number; average: number | null; reviews: PublicReview[] }
export interface AdminReview { id: string; page_key: string; rating: number; first_name: string; comment: string | null; lang: ReviewLang; status: ReviewStatus; created_at: string; moderated_at: string | null }

const missing = (e: unknown) => e instanceof DbError && (e.code === "42P01" || e.code === "PGRST205" || e.status === 404)

/** Texte brut : retire les caractères de contrôle et les balises, normalise les espaces. */
export function cleanText(v: unknown, max: number): string {
  return String(v ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‎‏‪-‮⁦-⁩]/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max)
}

// Spam : adresse web, e-mail ou téléphone collés dans un avis
const SPAM = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|tn|info|xyz|ru|cn|top|click)\b|@[a-z0-9-]+\.|\+?\d[\d\s().-]{7,}\d)/i

const MESSAGES: Record<string, string> = {
  page: "Page inconnue.",
  rating: "Choisissez une note de 1 à 5 étoiles.",
  name: "Prénom requis (2 à 60 caractères).",
  comment: "Commentaire : 600 caractères maximum, sans adresse web, e-mail ni numéro de téléphone.",
  consent: "Vous devez accepter la publication de votre prénom et de votre commentaire.",
}

/**
 * Valide et enregistre un avis « en attente ». Ne publie jamais.
 * `allow` est appelé SEULEMENT pour un avis valide (limitation stricte des avis acceptés : une faute de saisie ne consomme pas le quota).
 */
export async function submitReview(input: ReviewInput, opts: { allow?: () => boolean } = {}): Promise<SubmitResult> {
  const errors: Record<string, string> = {}
  const page = String(input.page ?? "")
  if (!REVIEW_PAGES.has(page)) errors.page = MESSAGES.page
  const rating = typeof input.rating === "number" ? input.rating : /^[1-5]$/.test(String(input.rating ?? "")) ? Number(input.rating) : NaN
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = MESSAGES.rating
  const name = cleanText(input.name, 60).replace(/\s+/g, " ")
  if (name.length < 2) errors.name = MESSAGES.name
  const rawComment = String(input.comment ?? "")
  const comment = cleanText(rawComment, 600)
  if (rawComment.trim().length > 600 || SPAM.test(comment) || SPAM.test(name)) errors.comment = MESSAGES.comment
  if (input.consent !== true && input.consent !== "true" && input.consent !== "on") errors.consent = MESSAGES.consent
  if (Object.keys(errors).length) return { ok: false, reason: "invalid", errors }
  // champ piège rempli : on répond « reçu » sans rien enregistrer (le robot ne sait pas qu'il a été écarté)
  if (cleanText(input.website, 200)) return { ok: true }
  if (opts.allow && !opts.allow()) return { ok: false, reason: "rate" }

  const lang: ReviewLang = input.lang === "fr" || input.lang === "en" ? input.lang : "ar"
  const hash = sha256(`${page}|${rating}|${name.toLowerCase()}|${comment.toLowerCase()}`)
  try {
    await insertOne("landing_reviews", { page_key: page, rating, first_name: name, comment: comment || null, lang, publish_consent: true, status: "pending", content_hash: hash })
    return { ok: true }
  } catch (e) {
    if (e instanceof DbError && e.isUniqueViolation) return { ok: true } // même avis déjà reçu : aucune erreur, aucun doublon
    if (missing(e)) return { ok: false, reason: "unavailable" }
    console.error("[reviews] enregistrement impossible", e instanceof Error ? e.message : "erreur")
    return { ok: false, reason: "unavailable" }
  }
}

/** Avis PUBLIÉS d'une page (les plus récents d'abord) et leur moyenne. Jamais un avis en attente ou refusé. */
export async function listPublished(page: string, limit = 20): Promise<PublishedReviews> {
  const empty: PublishedReviews = { count: 0, average: null, reviews: [] }
  if (!REVIEW_PAGES.has(page)) return empty
  try {
    const [rows, ratings] = await Promise.all([
      select<{ rating: number; first_name: string; comment: string | null; created_at: string }>(
        "landing_reviews", `select=rating,first_name,comment,created_at&page_key=eq.${page}&status=eq.published&order=created_at.desc&limit=${Math.min(Math.max(limit, 1), 50)}`),
      select<{ rating: number }>("landing_reviews", `select=rating&page_key=eq.${page}&status=eq.published&limit=5000`),
    ])
    const count = ratings.length
    const average = count ? Math.round((ratings.reduce((n, r) => n + Number(r.rating), 0) / count) * 10) / 10 : null
    return { count, average, reviews: rows.map((r) => ({ rating: Number(r.rating), name: r.first_name, comment: r.comment, created_at: r.created_at })) }
  } catch (e) {
    if (!missing(e)) console.error("[reviews] lecture impossible", e instanceof Error ? e.message : "erreur")
    return empty
  }
}

/** Liste d'administration par statut. `tableMissing` = migration 0025 non appliquée. */
export async function listForAdmin(status: ReviewStatus): Promise<{ reviews: AdminReview[]; tableMissing: boolean }> {
  try {
    const reviews = await select<AdminReview>("landing_reviews", `select=id,page_key,rating,first_name,comment,lang,status,created_at,moderated_at&status=eq.${status}&order=created_at.desc&limit=200`)
    return { reviews, tableMissing: false }
  } catch (e) {
    if (missing(e)) return { reviews: [], tableMissing: true }
    return { reviews: [], tableMissing: false }
  }
}

export async function countPending(): Promise<number> {
  try {
    return (await select<{ id: string }>("landing_reviews", "select=id&status=eq.pending&limit=1000")).length
  } catch {
    return 0
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Publie, refuse ou retire un avis. Seul le statut change (la note et le texte ne sont jamais modifiés). */
export async function moderateReview(id: string, status: Exclude<ReviewStatus, "pending">, actorId: string | null): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(id)) return { ok: false, error: "Avis introuvable." }
  if (status !== "published" && status !== "rejected") return { ok: false, error: "Statut invalide." }
  try {
    const rows = await update<{ id: string }>("landing_reviews", `id=eq.${id}`, { status, moderated_at: new Date().toISOString(), moderated_by: actorId })
    return rows.length ? { ok: true } : { ok: false, error: "Avis introuvable." }
  } catch (e) {
    if (missing(e)) return { ok: false, error: "La migration 0025 n'est pas encore appliquée." }
    console.error("[reviews] modération impossible", e instanceof Error ? e.message : "erreur")
    return { ok: false, error: "Modération impossible. Réessayez." }
  }
}
