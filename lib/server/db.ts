// Accès à la base Supabase DÉDIÉE aux landing pages (projet séparé du CRM EasyV4),
// via l'API REST (PostgREST). Aucune dépendance npm. Clé service_role côté serveur uniquement.

// Projets du CRM EasyV4 : toute connexion vers eux est refusée (protection contre une erreur de configuration).
const FORBIDDEN_PROJECT_REFS = ["crygnaichvlxavvbifqi", "fxjhahtqrglktrmgqkvs"]

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

async function request<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const cfg = config()
  if (!cfg) throw new DbConfigError("Base des landing pages non configurée (LANDING_SUPABASE_URL / LANDING_SUPABASE_SERVICE_ROLE_KEY)")
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
