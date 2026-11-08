// Gouvernance de la plateforme par le SUPER ADMIN : créer une entreprise et inviter son premier administrateur.
// Règles : l'identité vient du jeton de session vérifié auprès de Supabase (jamais d'une adresse envoyée par un navigateur) ;
// l'écriture passe uniquement par les fonctions SQL de la migration 0012 (service_role n'a aucun droit d'écriture direct) ;
// le Super Admin ne lit AUCUN lead : ce module ne touche à aucune table d'entreprise.
import { cookies } from "next/headers"
import { SITE_URL } from "@/lib/config"
import { AT_COOKIE, getAuthUser } from "./auth"
import { DbError, rpc, select } from "./db"
import { adminCfg, findAuthUserId } from "./team"
import { isPlatformAdmin } from "./tenant"

export interface PlatformActor {
  userId: string
  email: string
}

/** Super Admin connecté (jeton vérifié + présent dans platform_admins), ou null. */
export async function currentPlatformAdmin(): Promise<PlatformActor | null> {
  const token = cookies().get(AT_COOKIE)?.value
  if (!token) return null
  const user = await getAuthUser(token)
  if (!user) return null
  return (await isPlatformAdmin(user.id).catch(() => false)) ? { userId: user.id, email: user.email } : null
}

export interface OrgSummary {
  id: string
  slug: string
  name: string
  status: "active" | "suspended"
  sector: string | null
  created_at: string
  members: number
  admins: number
}

export async function listOrganizations(): Promise<OrgSummary[]> {
  const orgs = await select<Omit<OrgSummary, "members" | "admins">>("organizations", "select=id,slug,name,status,sector,created_at&order=created_at.asc")
  const members = await select<{ organization_id: string; role: string }>("organization_members", "select=organization_id,role&active=eq.true&limit=10000")
  return orgs.map((o) => {
    const mine = members.filter((m) => m.organization_id === o.id)
    return { ...o, members: mine.length, admins: mine.filter((m) => m.role === "admin").length }
  })
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i
const SLUG = /^[a-z0-9][a-z0-9-]{1,62}$/
const RESERVED = new Set(["admin", "api", "www", "app", "plateforme", "platform", "login", "static", "omra", "c", "easy2book"])

export const slugify = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)

export type CreateOrgResult =
  | { ok: true; organizationId: string; slug: string; email: string; invited: boolean }
  | { ok: false; error: string }

export interface CreateOrgInput {
  name: string
  slug: string
  sector: string
  adminEmail: string
  adminName: string
}

/** Invite l'adresse par e-mail (Supabase Auth). Renvoie l'identifiant du compte ; invited=false si le compte existait déjà. */
async function inviteUser(email: string, fullName: string): Promise<{ userId: string; invited: boolean } | { error: string }> {
  const { url, headers } = adminCfg()
  const redirect = encodeURIComponent(`${SITE_URL.replace(/\/$/, "")}/admin/invitation`)
  const res = await fetch(`${url}/auth/v1/invite?redirect_to=${redirect}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, data: { full_name: fullName } }),
    cache: "no-store",
  })
  if (res.ok) {
    const id = ((await res.json()) as { id?: string }).id
    return id ? { userId: id, invited: true } : { error: "Invitation envoyée mais compte introuvable : réessayez." }
  }
  if (res.status === 422 || res.status === 409) {
    const id = await findAuthUserId(email)
    return id ? { userId: id, invited: false } : { error: "Invitation refusée par Supabase (adresse déjà utilisée ?)." }
  }
  if (res.status === 429) return { error: "Trop d'e-mails envoyés pour le moment (limite Supabase). Réessayez plus tard ou configurez un expéditeur SMTP." }
  return { error: `Invitation refusée par Supabase (${res.status}).` }
}

export async function createOrganization(input: CreateOrgInput, actor: PlatformActor): Promise<CreateOrgResult> {
  const name = input.name.trim()
  const slug = (input.slug.trim() || slugify(name)).toLowerCase()
  const email = input.adminEmail.trim().toLowerCase()
  const adminName = input.adminName.trim().slice(0, 120)
  const sector = input.sector.trim().slice(0, 64)
  if (name.length < 2 || name.length > 160) return { ok: false, error: "Nom de l'entreprise : 2 à 160 caractères." }
  if (!SLUG.test(slug)) return { ok: false, error: "Identifiant : lettres minuscules, chiffres et tirets (2 à 63 caractères)." }
  if (RESERVED.has(slug)) return { ok: false, error: "Cet identifiant est réservé." }
  if (!EMAIL.test(email)) return { ok: false, error: "Adresse e-mail du premier administrateur invalide." }

  const taken = await select<{ id: string }>("organizations", `select=id&slug=eq.${encodeURIComponent(slug)}&limit=1`)
  if (taken.length) return { ok: false, error: "Cet identifiant est déjà utilisé par une autre entreprise." }

  const invite = await inviteUser(email, adminName)
  if ("error" in invite) return { ok: false, error: invite.error }

  try {
    const organizationId = await rpc<string>("landing_create_organization", {
      p_name: name,
      p_slug: slug,
      p_sector: sector,
      p_actor: actor.userId,
      p_admin_user: invite.userId,
      p_admin_email: email,
      p_admin_name: adminName,
    })
    return { ok: true, organizationId, slug, email, invited: invite.invited }
  } catch (e) {
    const msg = e instanceof DbError ? e.message : ""
    if (/0011/.test(msg)) return { ok: false, error: "Création impossible : la migration 0011 doit d'abord être appliquée (verrou contre une 2ᵉ organisation)." }
    if (/déjà rattaché/.test(msg)) return { ok: false, error: "Ce compte appartient déjà à une entreprise : utilisez une autre adresse." }
    if (/Super Admin/.test(msg)) return { ok: false, error: "Action réservée au Super Admin." }
    if (e instanceof DbError && e.isUniqueViolation) return { ok: false, error: "Identifiant d'entreprise déjà utilisé." }
    return { ok: false, error: "Création refusée par la base (migration 0012 appliquée ?). Aucune entreprise n'a été créée." }
  }
}

export async function setOrganizationStatus(orgId: string, status: "active" | "suspended", actor: PlatformActor): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) return { ok: false, error: "Entreprise introuvable." }
  try {
    await rpc("landing_set_organization_status", { p_org: orgId, p_status: status, p_actor: actor.userId })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof DbError ? e.message : ""
    if (/plateforme/.test(msg)) return { ok: false, error: "L'organisation de la plateforme ne peut pas être suspendue." }
    return { ok: false, error: "Modification refusée." }
  }
}
