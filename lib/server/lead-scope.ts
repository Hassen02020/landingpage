// Analyses : exclusion des leads marqués « test » (colonne is_test, migration 0026) ET des doublons CONFIRMÉS (colonne duplicate_of, migration 0030).
// Avant chaque migration, la colonne n'existe pas : on lit alors sans ce filtre (comportement historique), puis on réessaie le filtre
// toutes les minutes pour le reprendre dès que la migration est appliquée, sans attendre le renouvellement de l'instance serveur.
// Un doublon confirmé reste CONSULTABLE par sa fiche ; il ne compte plus dans aucun chiffre (ventes, chiffre d'affaires, conversion, marge).
import { DbError, select } from "@/lib/server/db"

const RECHECK_MS = 60_000
// Ordre important : `is_test` en dernier (les tests historiques vérifient que la requête se termine par ce filtre).
const FILTERS = [
  { col: "duplicate_of", clause: "duplicate_of=is.null" },
  { col: "is_test", clause: "is_test=eq.false" },
] as const
type Col = (typeof FILTERS)[number]["col"]
const missingSince: Record<Col, number | null> = { duplicate_of: null, is_test: null } // horodatage du dernier constat « colonne absente »

export const __resetLeadScope = () => { missingSince.duplicate_of = null; missingSince.is_test = null }

// 42703 = colonne inconnue. On ne conclut « colonne absente » que si le message de la base NOMME cette colonne : une autre colonne manquante
// dans la liste demandée (ex. tranche d'âge avant sa migration) ne doit jamais désactiver une exclusion.
const missingColumn = (e: unknown, cols: readonly Col[]): Col | null => {
  if (!(e instanceof DbError) || e.code !== "42703") return null
  return cols.find((c) => new RegExp(c).test(e.pgMessage ?? "")) ?? null
}
const isMissing = (c: Col) => missingSince[c] !== null && Date.now() - (missingSince[c] as number) < RECHECK_MS

async function selectFiltered<T>(query: string, cols: readonly Col[]): Promise<T[]> {
  for (let attempt = 0; attempt <= cols.length; attempt++) {
    const active = FILTERS.filter((f) => cols.includes(f.col) && !isMissing(f.col))
    try {
      const rows = await select<T>("landing_leads", active.length ? `${query}&${active.map((f) => f.clause).join("&")}` : query)
      for (const f of active) missingSince[f.col] = null
      return rows
    } catch (e) {
      const col = missingColumn(e, active.map((f) => f.col))
      if (!col) throw e
      missingSince[col] = Date.now()
    }
  }
  return select<T>("landing_leads", query)
}

/** Lecture des leads RÉELS (hors test) ET hors doublons confirmés. `query` est une requête PostgREST sans ces filtres. */
export const selectRealLeads = <T>(query: string): Promise<T[]> => selectFiltered<T>(query, ["duplicate_of", "is_test"])

/** Idem sans toucher aux leads de test (listes de travail où les tests restent visibles et marqués) : exclut seulement les doublons confirmés. */
export const selectLeadsExcludingDuplicates = <T>(query: string): Promise<T[]> => selectFiltered<T>(query, ["duplicate_of"])
