import { NextRequest } from "next/server"
import { withPublicOrg } from "@/lib/server/db"
import { handleLeadPost } from "@/lib/server/lead-intake"

export const runtime = "nodejs"

/**
 * POST /api/leads — formulaire des landing pages d'Easy2Book (logique dans lib/server/lead-intake.ts).
 * Point d'entrée rattaché explicitement à l'organisation du site public (contexte passant AVANT toute session) :
 * formulaire, suivi et scripts à clé d'API travaillent pour Easy2Book, jamais pour l'organisation d'un compte qui visite le site.
 */
export const POST = (request: NextRequest) => withPublicOrg(() => handleLeadPost(request, { platform: true }))
