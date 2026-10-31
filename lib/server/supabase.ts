// Accès Supabase côté serveur via l'API REST (PostgREST) — aucune dépendance npm requise.
// La clé service_role reste côté serveur : elle n'est jamais envoyée au navigateur.

function config() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { url: url.replace(/\/$/, ""), key }
}

export function supabaseConfigured(): boolean {
  return config() !== null
}

async function request<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const cfg = config()
  if (!cfg) throw new Error("Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      ...(init.prefer ? { Prefer: init.prefer } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    throw new Error(`Supabase ${res.status}: ${detail}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function insertRow<T = Record<string, unknown>>(table: string, row: Record<string, unknown>): Promise<T> {
  const rows = await request<T[]>(table, {
    method: "POST",
    body: JSON.stringify(row),
    prefer: "return=representation",
  })
  return rows[0]
}

export async function insertRowQuiet(table: string, row: Record<string, unknown>): Promise<void> {
  await request<void>(table, { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" })
}

export async function selectRows<T = Record<string, unknown>>(table: string, query: string): Promise<T[]> {
  return request<T[]>(`${table}?${query}`, { method: "GET" })
}

export async function updateRows<T = Record<string, unknown>>(
  table: string,
  filter: string,
  patch: Record<string, unknown>
): Promise<T[]> {
  return request<T[]>(`${table}?${filter}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    prefer: "return=representation",
  })
}
