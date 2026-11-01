// Protection des formulaires : numéros / IP bloqués et pays autorisés (réglés dans /admin/protection).
// En cas d'indisponibilité de la base, les leads sont ACCEPTÉS (on ne perd pas un vrai client).
import { select, update, upsertQuiet } from "./db"
import { normalizePhone } from "./hash"

export type BlockKind = "phone" | "ip"

export interface BlockRow {
  id: number
  kind: BlockKind
  value: string
  reason: string | null
  active: boolean
  created_at: string
  updated_at: string
  actor_label: string | null
}

interface Settings {
  allowedCountries: string[]
  phones: Set<string>
  ips: Set<string>
}

const TTL_MS = 60_000
let cached: { at: number; settings: Settings | null } | null = null

export function resetProtectionCache() {
  cached = null
}

async function loadSettings(): Promise<Settings | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.settings
  let settings: Settings | null = null
  try {
    const [blocks, prot] = await Promise.all([
      select<Pick<BlockRow, "kind" | "value">>("landing_blocklist", "select=kind,value&active=eq.true&limit=5000"),
      select<{ allowed_countries: string[] }>("landing_protection", "select=allowed_countries&id=eq.1&limit=1"),
    ])
    settings = {
      allowedCountries: prot[0]?.allowed_countries ?? [],
      phones: new Set(blocks.filter((b) => b.kind === "phone").map((b) => b.value)),
      ips: new Set(blocks.filter((b) => b.kind === "ip").map((b) => b.value)),
    }
  } catch {
    settings = null // migration 0003 non appliquée ou base indisponible : aucune restriction
  }
  cached = { at: Date.now(), settings }
  return settings
}

export type LeadCheck = { blocked: false } | { blocked: true; reason: "phone" | "ip" | "country" }

/** Vérifie un lead entrant. country = code pays ISO de l'IP (en-tête x-vercel-ip-country). */
export async function checkLead(input: { phone: string | null; ip?: string; country?: string | null }): Promise<LeadCheck> {
  const s = await loadSettings()
  if (!s) return { blocked: false }
  if (input.phone && s.phones.has(input.phone)) return { blocked: true, reason: "phone" }
  if (input.ip && s.ips.has(input.ip)) return { blocked: true, reason: "ip" }
  const country = (input.country || "").toUpperCase()
  // pays inconnu (en-tête absent) : accepté, pour ne pas refuser un vrai client par erreur
  if (s.allowedCountries.length && /^[A-Z]{2}$/.test(country) && !s.allowedCountries.includes(country)) {
    return { blocked: true, reason: "country" }
  }
  return { blocked: false }
}

// ---------------------------------------------------------------- administration
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
const IPV6 = /^[0-9a-fA-F:]{3,45}$/

export function normalizeBlockValue(kind: BlockKind, raw: string): string | null {
  const v = raw.trim()
  if (kind === "phone") return normalizePhone(v)
  if (IPV4.test(v)) return v
  if (IPV6.test(v) && v.includes(":")) return v.toLowerCase()
  return null
}

export interface Actor {
  id: string | null
  label: string
}

export async function block(kind: BlockKind, raw: string, reason: string, actor: Actor): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  const value = normalizeBlockValue(kind, raw)
  if (!value) return { ok: false, error: kind === "phone" ? "Numéro invalide (8 chiffres ou +indicatif)." : "Adresse IP invalide." }
  await upsertQuiet(
    "landing_blocklist",
    { kind, value, reason: reason.trim().slice(0, 200) || null, active: true, updated_at: new Date().toISOString(), updated_by: actor.id, actor_label: actor.label.slice(0, 320) },
    "kind,value"
  )
  resetProtectionCache()
  return { ok: true, value }
}

export async function unblock(id: number, actor: Actor): Promise<void> {
  await update("landing_blocklist", `id=eq.${id}`, { active: false, updated_at: new Date().toISOString(), updated_by: actor.id, actor_label: actor.label.slice(0, 320) })
  resetProtectionCache()
}

export const COUNTRIES: { code: string; name: string }[] = [
  { code: "TN", name: "Tunisie" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Allemagne" },
  { code: "IT", name: "Italie" },
  { code: "BE", name: "Belgique" },
  { code: "NL", name: "Pays-Bas" },
  { code: "CH", name: "Suisse" },
  { code: "GB", name: "Royaume-Uni" },
  { code: "CA", name: "Canada" },
  { code: "US", name: "États-Unis" },
  { code: "SA", name: "Arabie saoudite" },
  { code: "AE", name: "Émirats arabes unis" },
  { code: "QA", name: "Qatar" },
  { code: "LY", name: "Libye" },
  { code: "DZ", name: "Algérie" },
  { code: "MA", name: "Maroc" },
]

export async function setAllowedCountries(codes: string[], actor: Actor): Promise<void> {
  const valid = Array.from(new Set(codes.map((c) => c.toUpperCase()).filter((c) => COUNTRIES.some((k) => k.code === c))))
  await update("landing_protection", "id=eq.1", { allowed_countries: valid, updated_at: new Date().toISOString(), updated_by: actor.id })
  resetProtectionCache()
}

export async function protectionView(): Promise<{ migrationApplied: boolean; allowedCountries: string[]; blocks: BlockRow[] }> {
  try {
    const [prot, blocks] = await Promise.all([
      select<{ allowed_countries: string[] }>("landing_protection", "select=allowed_countries&id=eq.1&limit=1"),
      select<BlockRow>("landing_blocklist", "select=id,kind,value,reason,active,created_at,updated_at,actor_label&active=eq.true&order=updated_at.desc&limit=500"),
    ])
    return { migrationApplied: true, allowedCountries: prot[0]?.allowed_countries ?? [], blocks }
  } catch {
    return { migrationApplied: false, allowedCountries: [], blocks: [] }
  }
}
