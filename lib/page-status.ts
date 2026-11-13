// État de DISPONIBILITÉ d'une page (fonction PURE) : sert au Créateur (publication), au bloc « Lien publicitaire » et aux alertes.
// Règle d'expiration : une offre est expirée si sa date de départ est ANTÉRIEURE au jour courant (jour de Tunis, passé en paramètre) ;
// sans date, elle n'expire jamais ; le jour du départ elle reste valide. Cette règle ne change PAS l'affichage public (chantier distinct).
export interface OfferLike {
  visible: boolean
  archived_at?: string | null
  departure_date?: string | null
  seats_total?: number | null
  seats_sold?: number | null
}

export const isOfferExpired = (departureDate: string | null | undefined, today: string): boolean => Boolean(departureDate) && String(departureDate) < today

/** Une offre « valide » = affichée, non archivée, non expirée. (Une offre complète reste valide : elle est signalée à part.) */
export const isOfferValid = (o: OfferLike, today: string): boolean => o.visible && !o.archived_at && !isOfferExpired(o.departure_date, today)

export const isSoldOut = (o: OfferLike): boolean => o.seats_total !== null && o.seats_total !== undefined && o.seats_total - (o.seats_sold ?? 0) <= 0

export type PageState = "prete" | "masquee" | "sans_offre" | "offres_expirees"

export interface PageStatus {
  state: PageState
  /** la page peut-elle être présentée comme prête à recevoir de la publicité ? (avant la vérification HTTP réelle) */
  ok: boolean
  validOffers: number
  expiredOffers: number
  soldOutOffers: number
  label: string
  detail: string
  tone: "ok" | "warn" | "bad"
}

export function pageStatus(input: { visible: boolean; offers: OfferLike[]; today: string }): PageStatus {
  const live = input.offers.filter((o) => o.visible && !o.archived_at)
  const expired = live.filter((o) => isOfferExpired(o.departure_date, input.today)).length
  const valid = live.filter((o) => isOfferValid(o, input.today))
  const soldOut = valid.filter(isSoldOut).length
  const base = { validOffers: valid.length, expiredOffers: expired, soldOutOffers: soldOut }
  if (!input.visible) return { ...base, state: "masquee", ok: false, tone: "bad", label: "Masquée", detail: "La page n'est pas publiée : le lien ne mène à rien de visible. Publiez-la d'abord." }
  if (live.length === 0) return { ...base, state: "sans_offre", ok: false, tone: "bad", label: "Sans offre valide", detail: "Aucune offre affichée : un visiteur arriverait sur une page sans produit." }
  if (valid.length === 0) return { ...base, state: "offres_expirees", ok: false, tone: "bad", label: "Offres expirées", detail: "Toutes les offres affichées ont une date de départ passée." }
  return { ...base, state: "prete", ok: true, tone: soldOut === valid.length ? "warn" : "ok", label: "Prête", detail: soldOut === valid.length ? "Toutes les offres valides sont complètes." : `${valid.length} offre${valid.length > 1 ? "s" : ""} valide${valid.length > 1 ? "s" : ""}.` }
}
