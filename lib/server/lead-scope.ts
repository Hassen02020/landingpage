// Analyses : exclusion des leads marqués « test » (colonne is_test, migration 0026).
// Avant la migration, la colonne n'existe pas : on lit alors tous les leads (comportement historique), puis on réessaie le filtre
// toutes les minutes pour le reprendre dès que la migration est appliquée, sans attendre le renouvellement de l'instance serveur.
import { DbError, select } from "@/lib/server/db"

const RECHECK_MS = 60_000
let missingSince: number | null = null // horodatage du dernier constat « colonne absente »

export const __resetLeadScope = () => { missingSince = null }
// 42703 = colonne inconnue. On ne conclut « is_test absente » que si le message de la base NOMME is_test : une autre colonne manquante
// dans la liste demandée (ex. tranche d'âge avant sa migration) ne doit jamais désactiver l'exclusion des leads de test.
const isMissingColumn = (e: unknown) => e instanceof DbError && e.code === "42703" && /is_test/.test(e.pgMessage ?? "")

/** Lecture des leads RÉELS (hors test). `query` est une requête PostgREST sans filtre is_test. */
export async function selectRealLeads<T>(query: string): Promise<T[]> {
  if (missingSince === null || Date.now() - missingSince >= RECHECK_MS) {
    try {
      const rows = await select<T>("landing_leads", `${query}&is_test=eq.false`)
      missingSince = null
      return rows
    } catch (e) {
      if (!isMissingColumn(e)) throw e
      missingSince = Date.now()
    }
  }
  return select<T>("landing_leads", query)
}
