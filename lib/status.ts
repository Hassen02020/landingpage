// Pipeline commercial : définition UNIQUE des statuts (serveur, navigateur, tests).
// Cible : NOUVEAU → À CONTACTER → CONTACTÉ → À QUALIFIER → QUALIFIÉ → DEVIS / PROPOSITION → EN NÉGOCIATION
//         → RÉSERVATION EFFECTUÉE → GAGNÉ   (+ PERDU, depuis n'importe quelle étape ouverte).
// Compatibilité : les 5 statuts historiques gardent EXACTEMENT leur valeur en base
// (nouveau, contacte, qualifie, reserve, perdu). « Réservation effectuée » = `reserve`.

export const STATUSES = ["nouveau", "a_contacter", "contacte", "a_qualifier", "qualifie", "devis", "negociation", "reserve", "gagne", "perdu"] as const
export type Status = (typeof STATUSES)[number]

export const STATUS_LABELS: Record<Status, string> = {
  nouveau: "Nouveau",
  a_contacter: "À contacter",
  contacte: "Contacté",
  a_qualifier: "À qualifier",
  qualifie: "Qualifié",
  devis: "Devis / proposition",
  negociation: "En négociation",
  reserve: "Réservé",
  gagne: "Gagné",
  perdu: "Perdu",
}

/** Dossiers en cours (ni vendus ni perdus) : relances, tableau de bord, pipeline. */
export const OPEN_STATUSES: readonly Status[] = ["nouveau", "a_contacter", "contacte", "a_qualifier", "qualifie", "devis", "negociation"]
/** Vente enregistrée : montant obligatoire, date de réservation posée UNE fois, conversion publicitaire envoyée UNE fois. */
export const BOOKING_STATUSES: readonly Status[] = ["reserve", "gagne"]
/** Pas encore de premier contact : ne compte pas comme « traité ». */
export const UNTREATED_STATUSES: readonly Status[] = ["nouveau", "a_contacter"]

export const isStatus = (v: unknown): v is Status => typeof v === "string" && (STATUSES as readonly string[]).includes(v)
export const isOpen = (s: string): boolean => (OPEN_STATUSES as readonly string[]).includes(s)
export const isBooking = (s: string): boolean => (BOOKING_STATUSES as readonly string[]).includes(s)
export const isUntreated = (s: string): boolean => (UNTREATED_STATUSES as readonly string[]).includes(s)

/** Étape suivante proposée par le bouton « → » du pipeline (null = fin de chaîne). */
export const NEXT_STAGE: Record<Status, Status | null> = {
  nouveau: "a_contacter",
  a_contacter: "contacte",
  contacte: "a_qualifier",
  a_qualifier: "qualifie",
  qualifie: "devis",
  devis: "negociation",
  negociation: "reserve",
  reserve: "gagne",
  gagne: null,
  perdu: "contacte", // « rouvrir » le dossier
}

/** Filtre PostgREST `in.(a,b)` à partir d'une liste de statuts (valeurs fixes : aucune injection possible). */
export const inFilter = (list: readonly Status[]): string => `in.(${list.join(",")})`

/** Liste « a,b » venant d'une adresse : uniquement des statuts valides, sans doublon. */
export function parseStatusList(raw: string | undefined | null): Status[] {
  const out: Status[] = []
  for (const part of String(raw ?? "").split(",")) {
    const s = part.trim()
    if (isStatus(s) && !out.includes(s)) out.push(s)
  }
  return out
}
