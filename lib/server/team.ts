// Gestion de l'équipe depuis /admin/equipe : comptes Supabase Auth (API d'administration, clé
// serveur) + table landing_staff. Aucun e-mail n'est nécessaire : l'administrateur reçoit un mot
// de passe provisoire à transmettre, le membre le change dans « Mon compte ».
import { randomInt } from "node:crypto"
import { insertQuiet, select, update } from "./db"

export interface StaffMember {
  user_id: string
  email: string
  full_name: string | null
  role: "admin" | "manager" | "agent"
  active: boolean
  created_at: string
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i
const UUID = /^[0-9a-f-]{36}$/i
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

const normalizeRole = (r: string): "admin" | "manager" | "agent" => (r === "admin" ? "admin" : r === "manager" ? "manager" : "agent")

export function tempPassword(length = 14): string {
  let s = ""
  for (let i = 0; i < length; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return s
}

export function adminCfg() {
  const url = process.env.LANDING_SUPABASE_URL?.replace(/\/$/, "")
  const key = process.env.LANDING_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Base non configurée")
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } }
}

export async function findAuthUserId(email: string): Promise<string | null> {
  const { url, headers } = adminCfg()
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, { headers, cache: "no-store" })
    if (!res.ok) return null
    const json = (await res.json()) as { users?: { id: string; email?: string }[] }
    const hit = json.users?.find((u) => u.email?.toLowerCase() === email)
    if (hit) return hit.id
    if (!json.users || json.users.length < 200) return null
  }
  return null
}

export async function listTeam(): Promise<StaffMember[]> {
  return select<StaffMember>("landing_staff", "select=user_id,email,full_name,role,active,created_at&order=active.desc,email.asc")
}

async function log(actor: { id: string; label: string }, summary: string) {
  await insertQuiet("landing_admin_log", { actor_id: actor.id, actor_label: actor.label.slice(0, 320), area: "equipe", summary: summary.slice(0, 300) }).catch(() =>
    console.error("[equipe] journal non écrit")
  )
}

export type AddResult = { ok: true; email: string; password: string | null } | { ok: false; error: string }

/** Ajoute un membre. Compte Auth créé s'il n'existe pas (mot de passe provisoire renvoyé une seule fois). */
export async function addMember(input: { email: string; fullName: string; role: string }, actor: { id: string; label: string }): Promise<AddResult> {
  const email = input.email.trim().toLowerCase()
  if (!EMAIL.test(email)) return { ok: false, error: "Adresse e-mail invalide." }
  const role = normalizeRole(input.role)
  const fullName = input.fullName.trim().slice(0, 120) || null
  const existing = await select<StaffMember>("landing_staff", `select=user_id&email=eq.${encodeURIComponent(email)}&limit=1`)
  if (existing.length) return { ok: false, error: "Ce membre fait déjà partie de l'équipe." }

  const { url, headers } = adminCfg()
  let password: string | null = tempPassword()
  let userId: string | null = null
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
    cache: "no-store",
  })
  if (res.ok) {
    userId = ((await res.json()) as { id?: string }).id ?? null
  } else if (res.status === 422 || res.status === 409) {
    // compte déjà existant : on le rattache à l'équipe sans changer son mot de passe
    userId = await findAuthUserId(email)
    password = null
  }
  if (!userId) return { ok: false, error: `Création du compte refusée par Supabase (${res.status}).` }

  await insertQuiet("landing_staff", { user_id: userId, email, full_name: fullName, role, active: true })
  await log(actor, `ajout ${email} (${role})`)
  return { ok: true, email, password }
}

export async function updateMember(
  userId: string,
  patch: { role?: string; active?: boolean; fullName?: string },
  actor: { id: string; label: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID.test(userId)) return { ok: false, error: "Membre introuvable." }
  if (userId === actor.id && (patch.active === false || (patch.role !== undefined && patch.role !== "admin"))) {
    return { ok: false, error: "Vous ne pouvez pas retirer vos propres droits." }
  }
  const row: Record<string, unknown> = {}
  if (patch.role) row.role = normalizeRole(patch.role)
  if (patch.active !== undefined) row.active = patch.active
  if (patch.fullName !== undefined) row.full_name = patch.fullName.trim().slice(0, 120) || null
  try {
    await update("landing_staff", `user_id=eq.${userId}`, row)
  } catch {
    return { ok: false, error: "Modification refusée (il doit rester au moins un administrateur actif)." }
  }
  await log(actor, `${userId.slice(0, 8)} : ${Object.entries(row).map(([k, v]) => `${k}=${v}`).join(", ")}`)
  return { ok: true }
}

/** Nouveau mot de passe provisoire pour un membre (renvoyé une seule fois). */
export async function resetMemberPassword(userId: string, actor: { id: string; label: string }): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  if (!UUID.test(userId)) return { ok: false, error: "Membre introuvable." }
  const [member] = await select<StaffMember>("landing_staff", `select=user_id,email&user_id=eq.${userId}&limit=1`)
  if (!member) return { ok: false, error: "Membre introuvable." }
  const password = tempPassword()
  const { url, headers } = adminCfg()
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, { method: "PUT", headers, body: JSON.stringify({ password }), cache: "no-store" })
  if (!res.ok) return { ok: false, error: `Refusé par Supabase (${res.status}).` }
  await log(actor, `mot de passe provisoire pour ${member.email}`)
  return { ok: true, password }
}

/** Le membre connecté change son propre mot de passe (jeton de session de l'utilisateur). */
export async function changeOwnPassword(accessToken: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (password.length < 10) return { ok: false, error: "10 caractères minimum." }
  const url = process.env.LANDING_SUPABASE_URL?.replace(/\/$/, "")
  const key = process.env.LANDING_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return { ok: false, error: "Connexion non configurée." }
  const res = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: { apikey: key, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    cache: "no-store",
  })
  if (!res.ok) return { ok: false, error: res.status === 422 ? "Mot de passe refusé (trop faible ou identique à l'ancien)." : `Refusé (${res.status}).` }
  return { ok: true }
}
