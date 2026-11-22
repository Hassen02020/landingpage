"use server"

// Saisie des conversations — authentification et droits REVÉRIFIÉS à chaque appel (jamais seulement dans l'interface).
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { can } from "@/lib/permissions"
import { currentStaff } from "@/lib/server/auth"
import { rateLimited } from "@/lib/server/guard"
import { getLeadByRef } from "@/lib/server/crm"
import { cancelConversation, createIndividual, createLot, type ConvActor, type ConvResult } from "@/lib/server/conversations"

const BASE = "/admin/conversations"
const f = (fd: FormData, k: string) => String(fd.get(k) ?? "")

async function actor(): Promise<ConvActor> {
  const staff = await currentStaff()
  if (!staff) redirect("/admin/login")
  if (!can(staff.orgRole, "leads.view_all")) redirect("/admin?erreur=acces")
  return { id: staff.userId, label: staff.email, role: staff.orgRole }
}

function back(result: ConvResult, okMsg: string): never {
  revalidatePath(BASE)
  if (result.ok) redirect(`${BASE}?ok=${encodeURIComponent(okMsg)}`)
  const msg = result.message ?? Object.values(result.errors)[0] ?? "Enregistrement impossible."
  redirect(`${BASE}?erreur=${encodeURIComponent(msg)}`)
}

export async function addLotAction(fd: FormData): Promise<void> {
  const a = await actor()
  if (rateLimited(`conv:${a.id}`, 60, 10 * 60 * 1000)) back({ ok: false, errors: {}, message: "Trop de saisies : réessayez dans quelques minutes." }, "")
  back(await createLot(a, { channel: f(fd, "channel"), origin: f(fd, "origin"), campaign: f(fd, "campaign"), count: f(fd, "count"), day: f(fd, "day") }), "Lot enregistré")
}

export async function addConversationAction(fd: FormData): Promise<void> {
  const a = await actor()
  if (rateLimited(`conv:${a.id}`, 60, 10 * 60 * 1000)) back({ ok: false, errors: {}, message: "Trop de saisies : réessayez dans quelques minutes." }, "")
  let leadId = ""
  const ref = f(fd, "ref").trim().toUpperCase()
  if (ref) {
    const lead = /^E2B-[A-Z0-9]{6}$/.test(ref) ? await getLeadByRef(ref) : null // cloisonné par entreprise
    if (!lead) back({ ok: false, errors: {}, message: "Référence de dossier introuvable." }, "")
    leadId = lead!.id
  }
  back(await createIndividual(a, { channel: f(fd, "channel"), origin: f(fd, "origin"), campaign: f(fd, "campaign"), leadId }), "Conversation enregistrée")
}

export async function cancelConversationAction(fd: FormData): Promise<void> {
  const a = await actor()
  back(await cancelConversation(a, Number(f(fd, "id"))), "Conversation annulée")
}
