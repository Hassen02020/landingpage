// Accès à la base Supabase DÉDIÉE aux landing pages (projet séparé du CRM EasyV4),
// via l'API REST (PostgREST). Aucune dépendance npm. Clé service_role côté serveur uniquement.

// Projets du CRM EasyV4 : toute connexion vers eux est refusée (protection contre une erreur de configuration).
const FORBIDDEN_PROJECT_REFS = ["crygnaichvlxavvbifqi", "fxjhahtqrglktrmgqkvs"]

import { AsyncLocalStorage } from "node:async_hooks"
import { isOrgId } from "@/lib/org-id"

export class DbConfigError extends Error {}

export class DbError extends Error {
  constructor(public status: number, public code: string | undefined, message: string) {
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
// Vues sans colonne organization_id : agrègent TOUTES les organisations → refusées en mode multi.
const UNSCOPED_VIEWS: ReadonlySet<string> = new Set(["landing_campaign_performance", "landing_niche_performance"])
// Fonctions SQL qui agissent sur toutes les organisations → refusées en mode multi.
const UNSCOPED_RPC: ReadonlySet<string> = new Set(["landing_redeem_promo", "landing_purge_personal_data"])
// Tables dont une unicité est encore GLOBALE : une écriture depuis une organisation pourrait entrer en conflit
// avec (et révéler) les données d'une autre → écritures refusées en mode multi tant que les unicités ne sont pas par organisation.
const GLOBAL_UNIQUE_TABLES: ReadonlySet<string> = new Set(["landing_integrations", "landing_promo_codes", "landing_offers", "landing_categories", "landing_staff", "landing_protection"])

export class TenantContextError extends Error {}

const orgStore = new AsyncLocalStorage<{ orgId: string }>()

/** Exécute `fn` (et tout ce qu'elle attend) dans le contexte de l'organisation `orgId`. */
export function runWithOrg<T>(orgId: string, fn: () => Promise<T> | T): Promise<T> | T {
  if (!isOrgId(orgId)) throw new TenantContextError("identifiant d'organisation invalide")
  return orgStore.run({ orgId }, fn)
}
export const currentOrgContext = (): string | null => orgStore.getStore()?.orgId ?? null

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

/** Applique le cloisonnement à une requête. Retourne le chemin et le corps à envoyer. */
async function scopeRequest(cfg: { url: string; key: string }, path: string, init: RequestInit): Promise<{ path: string; body: RequestInit["body"] }> {
  const q = path.indexOf("?")
  const target = q === -1 ? path : path.slice(0, q)
  const query = q === -1 ? "" : path.slice(q + 1)
  const method = (init.method || "GET").toUpperCase()

  if (target.startsWith("rpc/")) {
    if (!UNSCOPED_RPC.has(target.slice(4))) return { path, body: init.body }
    if ((await tenantMode(cfg)).kind === "multi") throw new TenantContextError(`fonction ${target.slice(4)} non cloisonnée par organisation : refusée en mode multi-entreprises`)
    return { path, body: init.body }
  }
  const tenant = TENANT_TABLES.has(target)
  if (!tenant && !UNSCOPED_VIEWS.has(target)) return { path, body: init.body }

  const mode = await tenantMode(cfg)
  if (mode.kind === "off") return { path, body: init.body }
  if (!tenant) {
    if (mode.kind === "multi") throw new TenantContextError(`vue ${target} non cloisonnée par organisation : refusée en mode multi-entreprises`)
    return { path, body: init.body }
  }

  const ctx = currentOrgContext()
  let org: string
  if (mode.kind === "single") {
    if (ctx !== null && ctx !== mode.orgId) throw new TenantContextError("organisation du contexte inconnue de cette base")
    org = mode.orgId
  } else {
    if (ctx === null) throw new TenantContextError(`contexte d'organisation manquant pour ${target} (mode multi-entreprises) : requête refusée`)
    org = ctx
  }
  if (mode.kind === "multi" && method !== "GET" && GLOBAL_UNIQUE_TABLES.has(target)) {
    throw new TenantContextError(`écriture dans ${target} refusée en mode multi-entreprises : unicités encore globales`)
  }

  if (method === "POST") {
    if (init.body === undefined || init.body === null) return { path, body: init.body }
    const parsed = JSON.parse(String(init.body)) as Record<string, unknown> | Record<string, unknown>[]
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    for (const row of rows) {
      if (row.organization_id === undefined) row.organization_id = org
      else if (row.organization_id !== org) throw new TenantContextError("écriture refusée : organisation différente de celle du contexte")
    }
    return { path, body: JSON.stringify(parsed) }
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
    throw new DbError(res.status, detail.code, `Supabase ${res.status} ${detail.code ?? ""}`.trim())
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
