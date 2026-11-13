"use server"

// Test d'un lien publicitaire depuis le dashboard (lecture seule : une requête GET vers notre propre site).
import { currentStaff } from "@/lib/server/auth"
import { isPlatformOrg } from "@/lib/server/db"
import { publicCategories } from "@/lib/server/catalog"
import { destinationsFor } from "@/lib/links"
import { checkDestination, type LinkCheck } from "@/lib/server/link-check"
import { rateLimited } from "@/lib/server/guard"

export async function checkDestinationAction(path: string): Promise<LinkCheck> {
  const refused = (message: string): LinkCheck => ({ state: "refused", checkedUrl: String(path ?? ""), at: new Date().toISOString(), message })
  const staff = await currentStaff()
  if (!staff) return refused("Session expirée : reconnectez-vous.")
  if (rateLimited(`linkcheck:${staff.userId}`, 60, 10 * 60 * 1000)) return refused("Trop de vérifications. Réessayez dans quelques minutes.")
  // les pages servies publiquement sont celles de la PLATEFORME : jamais une vérification (ni un lien) pour une autre entreprise
  if (!(await isPlatformOrg())) return refused("Les liens vers des pages du site ne sont proposés qu'à l'organisation de la plateforme.")
  const categories = await publicCategories().catch(() => [])
  return checkDestination(String(path ?? ""), destinationsFor(categories).map((d) => d.path))
}
