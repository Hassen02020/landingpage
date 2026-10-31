"use server"

// Actions serveur de l'interface /admin. Chaque action revérifie l'identité ET
// l'appartenance à l'équipe (jamais de confiance dans le formulaire).
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import {
  AT_COOKIE,
  RT_COOKIE,
  cookieOptions,
  currentStaff,
  findStaff,
  signInWithPassword,
  signOut,
  type Staff,
} from "@/lib/server/auth"
import { rateLimited } from "@/lib/server/guard"
import {
  addNote,
  assignLead,
  changeStatus,
  createManualLead,
  getLead,
  isStatus,
  setFollowUp,
  withdrawMarketing,
  type Actor,
} from "@/lib/server/crm"

const actorOf = (s: Staff): Actor => ({ id: s.userId, label: s.email })
const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim()

async function requireStaff(): Promise<Staff> {
  const staff = await currentStaff()
  if (!staff) redirect("/admin/login")
  return staff
}

function safeNext(next: string): string {
  return /^\/admin(\/[A-Za-z0-9\-/]*)?$/.test(next) ? next : "/admin"
}

export async function loginAction(_prev: { error?: string } | undefined, fd: FormData): Promise<{ error?: string }> {
  const email = field(fd, "email").toLowerCase()
  const password = String(fd.get("password") ?? "")
  if (!email || !password) return { error: "E-mail et mot de passe requis." }
  if (rateLimited(`login:${email}`, 5, 15 * 60 * 1000)) return { error: "Trop de tentatives. Réessayez dans 15 minutes." }

  const session = await signInWithPassword(email, password)
  if (!session?.user?.id) return { error: "Identifiants invalides." }
  const staff = await findStaff(session.user.id)
  if (!staff) {
    await signOut(session.access_token)
    return { error: "Ce compte n'a pas accès à l'espace équipe." }
  }
  cookies().set(AT_COOKIE, session.access_token, cookieOptions(session.expires_in))
  cookies().set(RT_COOKIE, session.refresh_token, cookieOptions(60 * 60 * 24 * 30))
  redirect(safeNext(field(fd, "next")))
}

export async function logoutAction(): Promise<void> {
  const token = cookies().get(AT_COOKIE)?.value
  if (token) await signOut(token)
  cookies().delete(AT_COOKIE)
  cookies().delete(RT_COOKIE)
  redirect("/admin/login")
}

async function leadOr404(fd: FormData) {
  const lead = await getLead(field(fd, "id"))
  if (!lead) redirect("/admin?erreur=introuvable")
  return lead
}

export async function changeStatusAction(fd: FormData): Promise<void> {
  const staff = await requireStaff()
  const lead = await leadOr404(fd)
  const status = field(fd, "status")
  if (!isStatus(status)) redirect(`/admin/leads/${lead.id}?erreur=statut`)
  const raw = field(fd, "booking_value")
  const result = await changeStatus(lead, status, actorOf(staff), {
    bookingValue: raw ? Number(raw.replace(",", ".")) : undefined,
    notes: field(fd, "notes") || undefined,
  })
  revalidatePath(`/admin/leads/${lead.id}`)
  if (!result.ok) redirect(`/admin/leads/${lead.id}?erreur=${encodeURIComponent(result.error)}`)
  redirect(`/admin/leads/${lead.id}?ok=${encodeURIComponent(result.conversion === "envoyée" ? "Statut enregistré — vente transmise à Meta/TikTok" : "Statut enregistré")}`)
}

export async function addNoteAction(fd: FormData): Promise<void> {
  const staff = await requireStaff()
  const lead = await leadOr404(fd)
  const result = await addNote(lead, field(fd, "body"), actorOf(staff))
  revalidatePath(`/admin/leads/${lead.id}`)
  if (!result.ok) redirect(`/admin/leads/${lead.id}?erreur=${encodeURIComponent(result.error)}`)
  redirect(`/admin/leads/${lead.id}?ok=Note+ajout%C3%A9e`)
}

export async function followUpAction(fd: FormData): Promise<void> {
  const staff = await requireStaff()
  const lead = await leadOr404(fd)
  const result = await setFollowUp(lead, field(fd, "follow_up") || null, actorOf(staff))
  revalidatePath(`/admin/leads/${lead.id}`)
  if (!result.ok) redirect(`/admin/leads/${lead.id}?erreur=${encodeURIComponent(result.error)}`)
  redirect(`/admin/leads/${lead.id}?ok=Relance+enregistr%C3%A9e`)
}

export async function assignAction(fd: FormData): Promise<void> {
  const staff = await requireStaff()
  const lead = await leadOr404(fd)
  const result = await assignLead(lead, field(fd, "assigned_to") || null, actorOf(staff))
  revalidatePath(`/admin/leads/${lead.id}`)
  if (!result.ok) redirect(`/admin/leads/${lead.id}?erreur=${encodeURIComponent(result.error)}`)
  redirect(`/admin/leads/${lead.id}?ok=Assignation+enregistr%C3%A9e`)
}

export async function withdrawMarketingAction(fd: FormData): Promise<void> {
  const staff = await requireStaff()
  const lead = await leadOr404(fd)
  const result = await withdrawMarketing(lead, actorOf(staff))
  revalidatePath(`/admin/leads/${lead.id}`)
  if (!result.ok) redirect(`/admin/leads/${lead.id}?erreur=${encodeURIComponent(result.error)}`)
  redirect(`/admin/leads/${lead.id}?ok=Consentement+marketing+retir%C3%A9`)
}

export async function createLeadAction(fd: FormData): Promise<void> {
  const staff = await requireStaff()
  const result = await createManualLead(
    {
      name: field(fd, "name"),
      phone: field(fd, "phone"),
      product: field(fd, "product"),
      source: field(fd, "source"),
      offer: field(fd, "offer"),
      destination: field(fd, "destination"),
      message: field(fd, "message"),
    },
    actorOf(staff)
  )
  if (!result.ok) redirect(`/admin/leads/new?erreur=${encodeURIComponent(result.error)}`)
  redirect(`/admin/leads/${result.id}?ok=Lead+cr%C3%A9%C3%A9`)
}
