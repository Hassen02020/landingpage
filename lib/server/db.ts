// Accès à la base Supabase DÉDIÉE aux landing pages (projet séparé du CRM EasyV4),
// via l'API REST (PostgREST). Aucune dépendance npm. Clé service_role côté serveur uniquement.

// Projets du CRM EasyV4 : toute connexion vers eux est refusée (protection contre une erreur de configuration).
const FORBIDDEN_PROJECT_REFS = ["crygnaichvlxavvbifqi", "fxjhahtqrglktrmgqkvs"]

import { AsyncLocalStorage } from "node:async_hooks"
import { isOrgId } from "@/lib/org-id"

export class DbConfigError extends Error {}

export class DbError extends Error {
  // pgMessage : texte de l'erreur PostgreSQL (nos propres fonctions SQL), jamais inclus dans `message` ni dans les journaux
  constructor(public status: number, public code: string | undefined, message: string, public pgMessage?: string) {
    super(message)
  }
  get isUniqueViolation() {
    return this.status === 409 || this.code === "23505"
  }
}

function config() {
  const url = process.env.LANDING_SUPABASE_URL
  const key = process.env.LANDING_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    throw new DbConfigError("LANDING_SUPABASE_URL invalide")
  }
  if (FORBIDDEN_PROJECT_REFS.some((ref) => host.includes(ref))) {
    throw new DbConfigError("LANDING_SUPABASE_URL pointe vers le CRM EasyV4 : interdit, utiliser le projet des landing pages")
  }
  return { url: url.replace(/\/$/, ""), key }
}

export function dbConfigured(): boolean {
  try {
    return config() !== null
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------------------------
// CLOISONNEMENT PAR ORGANISATION (chantier TENANT-APP-SCOPING-02)
// Toute requête vers une table d'entreprise est restreinte à UNE organisation, ici et nulle part ailleurs :
//   • lecture / modification : filtre `organization_id=eq.<org>` ajouté ;
//   • insertion : `organization_id` ajouté ; une valeur d'une AUTRE organisation est refusée.
// Mode détecté automatiquement (sonde sur la table `organizations`, relue toutes les 30 s) :
//   off    : table absente ou vide (migration 0008 non appliquée, retour arrière) → comportement historique ;
//   single : une seule organisation → tout est rattaché à elle (Easy2Book aujourd'hui) ;
//   multi  : plusieurs organisations → un contexte d'organisation (runWithOrg) est OBLIGATOIRE ;
//            sans contexte la requête est REFUSÉE (jamais de lecture au hasard d'une autre entreprise).
// ---------------------------------------------------------------------------------------------
export const TENANT_TABLES: ReadonlySet<string> = new Set([
  "landing_leads", "landing_events", "landing_lead_activities", "landing_staff", "landing_integrations",
  "landing_integration_changes", "landing_admin_log", "landing_protection", "landing_blocklist",
  "landing_categories", "landing_offers", "landing_promo_codes", "landing_message_templates",
])
// Vues de performance : une ligne PAR ORGANISATION (colonne organization_id, migration 0010). Filtrées en mode multi ;
// en mode « une organisation » elles sont lues telles quelles (aucun filtre nécessaire, et le site fonctionne avant 0010).
const VIEWS_WITH_ORG: ReadonlySet<string> = new Set(["landing_campaign_performance", "landing_niche_performance"])
// Fonctions SQL qui agissent sur TOUTES les organisations (entretien de la base) → refusées en mode multi.
const GLOBAL_RPC: ReadonlySet<string> = new Set(["landing_purge_personal_data"])
// Fonctions SQL par organisation : le serveur leur passe l'organisation (p_org, fonction à 3 arguments de la migration 0010).
const ORG_RPC: ReadonlySet<string> = new Set(["landing_redeem_promo"])

export class TenantContextError extends Error {}

const orgStore = new AsyncLocalStorage<{ orgId: string }>()

/** Exécute `fn` (et tout ce qu'elle attend) dans le contexte de l'organisation `orgId`. */
export function runWithOrg<T>(orgId: string, fn: () => Promise<T> | T): Promise<T> | T {
  if (!isOrgId(orgId)) throw new TenantContextError("identifiant d'organisation invalide")
  return orgStore.run({ orgId }, fn)
}
export const currentOrgContext = (): string | null => orgStore.getStore()?.orgId ?? null

// Chargement tardif : session-org → auth → db (évite le cycle d'import au chargement du module).
async function sessionOrg(): Promise<string | null> {
  try {
    return await (await import("./session-org")).resolveSessionOrg()
  } catch {
    return null // en cas de doute : pas d'organisation → refus
  }
}

type TenantMode = { kind: "off" } | { kind: "single"; orgId: string } | { kind: "multi" }
const MODE_TTL_MS = 30_000
let modeCache: { at: number; mode: TenantMode } | null = null
export function resetTenantModeCache(): void {
  modeCache = null
}

async function tenantMode(cfg: { url: string; key: string }): Promise<TenantMode> {
  if (modeCache && Date.now() - modeCache.at < MODE_TTL_MS) return modeCache.mode
  // Pas de `cache: "no-store"` : il ferait basculer en dynamique les pages statiques à rafraîchissement (/omra, /c/[slug],
  // « Page changed from static to dynamic at runtime »). Le cache de données de Next garde la réponse 30 s.
  const res = await fetch(`${cfg.url}/rest/v1/organizations?select=id&limit=2`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    next: { revalidate: MODE_TTL_MS / 1000 },
  })
  let mode: TenantMode
  if (res.status === 404) {
    mode = { kind: "off" } // table absente : schéma d'avant 0008
  } else if (!res.ok) {
    // sonde impossible : on garde le dernier mode connu (même périmé) ; sinon on se comporte comme une panne de base
    if (modeCache) return modeCache.mode
    throw new DbError(res.status, undefined, `Supabase ${res.status} (détection du mode multi-entreprises)`)
  } else {
    const rows = (await res.json().catch(() => [])) as { id?: string }[]
    mode = !Array.isArray(rows) || rows.length === 0 ? { kind: "off" } : rows.length === 1 && isOrgId(rows[0].id) ? { kind: "single", orgId: rows[0].id! } : { kind: "multi" }
  }
  modeCache = { at: Date.now(), mode }
  return mode
}

/** Organisation de la requête : « single » → l'unique organisation ; « multi » → contexte explicite, sinon compte connecté, sinon REFUS. */
async function orgFor(mode: TenantMode, target: string): Promise<string> {
  const ctx = currentOrgContext()
  if (mode.kind === "single") {
    if (ctx !== null && ctx !== mode.orgId) throw new TenantContextError("organisation du contexte inconnue de cette base")
    return mode.orgId
  }
  const resolved = ctx ?? (await sessionOrg())
  if (resolved === null) throw new TenantContextError(`contexte d'organisation manquant pour ${target} (mode multi-entreprises) : requête refusée`)
  return resolved
}

/** Applique le cloisonnement à une requête. Retourne le chemin et le corps à envoyer. */
async function scopeRequest(cfg: { url: string; key: string }, path: string, init: RequestInit): Promise<{ path: string; body: RequestInit["body"] }> {
  const q = path.indexOf("?")
  const target = q === -1 ? path : path.slice(0, q)
  const query = q === -1 ? "" : path.slice(q + 1)
  const method = (init.method || "GET").toUpperCase()
  const unchanged = { path, body: init.body }

  if (target.startsWith("rpc/")) {
    const fn = target.slice(4)
    const isGlobal = GLOBAL_RPC.has(fn)
    if (!isGlobal && !ORG_RPC.has(fn)) return unchanged
    const mode = await tenantMode(cfg)
    if (mode.kind === "off") return unchanged
    if (isGlobal) {
      if (mode.kind === "multi") throw new TenantContextError(`fonction ${fn} non cloisonnée par organisation : refusée en mode multi-entreprises`)
      return unchanged
    }
    const org = await orgFor(mode, target)
    const args = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>
    if (args.p_org !== undefined && args.p_org !== org) throw new TenantContextError("fonction appelée pour une organisation différente de celle du contexte : refusé")
    return { path, body: JSON.stringify({ ...args, p_org: org }) }
  }

  const tenant = TENANT_TABLES.has(target)
  const view = VIEWS_WITH_ORG.has(target)
  if (!tenant && !view) return unchanged
  const mode = await tenantMode(cfg)
  if (mode.kind === "off") return unchanged
  if (view && mode.kind === "single") return unchanged
  const org = await orgFor(mode, target)

  if (method === "POST") {
    if (init.body === undefined || init.body === null) return unchanged
    const parsed = JSON.parse(String(init.body)) as Record<string, unknown> | Record<string, unknown>[]
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    for (const row of rows) {
      if (row.organization_id === undefined) row.organization_id = org
      else if (row.organization_id !== org) throw new TenantContextError("écriture refusée : organisation différente de celle du contexte")
    }
    // « insérer ou mettre à jour » : la cible de conflit est TOUJOURS (organisation, …) : une ligne d'une autre organisation n'est jamais écrasée
    let outPath = path
    const params = query.split("&")
    const at = params.findIndex((p) => p.startsWith("on_conflict="))
    if (at >= 0) {
      const cols = decodeURIComponent(params[at].slice("on_conflict=".length)).split(",")
      if (!cols.includes("organization_id")) {
        params[at] = `on_conflict=${encodeURIComponent(["organization_id", ...cols].join(","))}`
        outPath = `${target}?${params.join("&")}`
      }
    }
    return { path: outPath, body: JSON.stringify(parsed) }
  }

  // GET / PATCH / DELETE : filtre d'organisation ; un filtre explicite sur une AUTRE organisation est refusé
  const explicit = query.split("&").find((p) => p.startsWith("organization_id="))
  if (explicit !== undefined && explicit !== `organization_id=eq.${org}`) throw new TenantContextError("filtre d'organisation différent de celui du contexte : refusé")
  let body = init.body
  if (method === "PATCH" && body) {
    const patch = JSON.parse(String(body)) as Record<string, unknown>
    if (patch.organization_id !== undefined && patch.organization_id !== org) throw new TenantContextError("changement d'organisation refusé")
  }
  const scopedQuery = explicit !== undefined ? query : query ? `${query}&organization_id=eq.${org}` : `organization_id=eq.${org}`
  return { path: `${target}?${scopedQuery}`, body }
}

const PUBLIC_ORG_SLUG = "easy2book" // le site public de cette plateforme est celui de l'organisation n°1
let publicOrgCache: { at: number; org: string | null } | null = null
export function resetPublicOrgCache(): void {
  publicOrgCache = null
}

/** Organisation du site public (slug « easy2book »), ou null si introuvable / schéma d'avant 0008. */
async function publicOrgId(): Promise<string | null> {
  const cfg = config()
  if (!cfg) return null
  if (publicOrgCache && Date.now() - publicOrgCache.at < MODE_TTL_MS) return publicOrgCache.org
  // `next.revalidate` et non `no-store` : pas de bascule en dynamique des pages statiques (/omra, /c/[slug])
  const res = await fetch(`${cfg.url}/rest/v1/organizations?select=id&slug=eq.${PUBLIC_ORG_SLUG}&limit=1`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    next: { revalidate: MODE_TTL_MS / 1000 },
  })
  if (!res.ok) {
    if (res.status === 404) return null
    if (publicOrgCache) return publicOrgCache.org
    throw new DbError(res.status, undefined, `Supabase ${res.status} (organisation du site public)`)
  }
  const rows = (await res.json().catch(() => [])) as { id?: string }[]
  const org = Array.isArray(rows) && rows.length === 1 && isOrgId(rows[0].id) ? rows[0].id! : null
  publicOrgCache = { at: Date.now(), org }
  return org
}

/**
 * Point d'entrée PUBLIC (formulaire, suivi, pages publiques) ou script à clé d'API : travaille explicitement pour l'organisation du
 * site public. Ce contexte explicite passe AVANT toute session : un compte connecté d'une autre entreprise qui visite le site
 * public ne peut pas y créer de lead dans sa propre organisation.
 */
export async function withPublicOrg<T>(fn: () => Promise<T> | T): Promise<T> {
  const org = await publicOrgId().catch(() => null)
  return org ? await runWithOrg(org, fn) : await fn()
}

/**
 * Clé d'organisation de la requête courante, pour les CACHES MÉMOIRE : « off » avant 0008, sinon l'organisation.
 * Jamais partagée entre deux entreprises. null : organisation indéterminée (pas de contexte ni de session en mode multi) → ne rien mettre en cache.
 */
export async function currentOrgKey(): Promise<string | null> {
  try {
    const cfg = config()
    if (!cfg) return "off"
    const mode = await tenantMode(cfg)
    return mode.kind === "off" ? "off" : await orgFor(mode, "cache")
  } catch {
    return null
  }
}

/**
 * L'organisation courante est-elle celle de la PLATEFORME (site public, slug « easy2book ») ? Avant 0008 et avec une seule organisation : oui.
 * En mode multi, seule l'organisation de la plateforme peut utiliser les variables Vercel (jeton et pixel d'Easy2Book) : une autre entreprise
 * ne doit JAMAIS en hériter. Organisation indéterminée : non.
 */
export async function isPlatformOrg(): Promise<boolean> {
  try {
    const cfg = config()
    if (!cfg) return true
    const mode = await tenantMode(cfg)
    if (mode.kind !== "multi") return true
    return (await orgFor(mode, "plateforme")) === (await publicOrgId())
  } catch {
    return false
  }
}

async function request<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const cfg = config()
  if (!cfg) throw new DbConfigError("Base des landing pages non configurée (LANDING_SUPABASE_URL / LANDING_SUPABASE_SERVICE_ROLE_KEY)")
  const scoped = await scopeRequest(cfg, path, init)
  path = scoped.path
  init = { ...init, body: scoped.body }
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    cache: "no-store",
  })
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as { code?: string; message?: string }
    // pas de corps de requête dans l'erreur (données personnelles)
    throw new DbError(res.status, detail.code, `Supabase ${res.status} ${detail.code ?? ""}`.trim(), typeof detail.message === "string" ? detail.message.slice(0, 300) : undefined)
  }
  if (res.status === 204) return undefined as T
  // PostgREST répond 201 avec un corps VIDE pour « return=minimal » : ne pas appeler res.json()
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export async function insertOne<T>(table: string, row: Record<string, unknown>): Promise<T> {
  const rows = await request<T[]>(table, { method: "POST", body: JSON.stringify(row), prefer: "return=representation" })
  return rows[0]
}

export async function insertQuiet(table: string, row: Record<string, unknown>): Promise<void> {
  await request<void>(table, { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" })
}

// Insère ou met à jour (clé de conflit = onConflict). Nécessite les droits INSERT et UPDATE.
export async function upsertQuiet(table: string, row: Record<string, unknown>, onConflict: string): Promise<void> {
  await request<void>(`${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    body: JSON.stringify(row),
    prefer: "resolution=merge-duplicates,return=minimal",
  })
}

// Appel d'une fonction SQL exposée (POST /rest/v1/rpc/<nom>).
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  return request<T>(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) })
}

export async function select<T>(table: string, query: string): Promise<T[]> {
  return request<T[]>(`${table}?${query}`, { method: "GET" })
}

export async function update<T>(table: string, filter: string, patch: Record<string, unknown>): Promise<T[]> {
  return request<T[]>(`${table}?${filter}`, { method: "PATCH", body: JSON.stringify(patch), prefer: "return=representation" })
}
