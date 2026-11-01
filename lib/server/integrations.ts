// Intégrations publicitaires (Meta, TikTok) réglables depuis /admin/integrations.
// Priorité : réglage enregistré dans /admin (table landing_integrations) ; un champ laissé vide
// reprend la variable Vercel correspondante. Une intégration désactivée dans /admin est coupée,
// même si des variables Vercel existent.
import { dbConfigured, insertQuiet, select, upsertQuiet } from "./db"
import { open, seal, SecretBoxError } from "./secret-box"

export type Provider = "meta" | "tiktok"
export const PROVIDERS: Provider[] = ["meta", "tiktok"]

export interface IntegrationRow {
  provider: Provider
  enabled: boolean
  pixel_id: string | null
  test_event_code: string | null
  token_ciphertext: string | null
  token_last4: string | null
  last_test_at: string | null
  last_test_ok: boolean | null
  last_test_message: string | null
  updated_at: string
  updated_by: string | null
}

export interface ResolvedIntegration {
  enabled: boolean
  pixelId?: string
  token?: string
  testEventCode?: string
  pixelSource: "admin" | "vercel" | "none"
  tokenSource: "admin" | "vercel" | "none"
  tokenUnreadable?: boolean
}

const ENV = {
  meta: {
    pixel: () => process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || "1674012850599992",
    token: () => process.env.META_ACCESS_TOKEN || "",
    test: () => process.env.META_TEST_EVENT_CODE || "",
  },
  tiktok: {
    pixel: () => process.env.TIKTOK_PIXEL_ID || process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || "",
    token: () => process.env.TIKTOK_ACCESS_TOKEN || "",
    test: () => process.env.TIKTOK_TEST_EVENT_CODE || "",
  },
} as const

// ---------- lecture (avec cache court : une lecture par minute et par instance) ----------
const TTL_MS = 60_000
const cache = new Map<Provider, { at: number; row: IntegrationRow | null }>()

export function resetIntegrationCache() {
  cache.clear()
}

async function loadRow(provider: Provider): Promise<IntegrationRow | null> {
  if (!dbConfigured()) return null
  const hit = cache.get(provider)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.row
  let row: IntegrationRow | null = null
  try {
    const rows = await select<IntegrationRow>("landing_integrations", `select=*&provider=eq.${provider}&limit=1`)
    row = rows.find((r) => r.provider === provider) ?? null
  } catch {
    // table absente (migration 0003 non appliquée) ou base indisponible : variables Vercel
    row = null
  }
  cache.set(provider, { at: Date.now(), row })
  return row
}

export async function resolveIntegration(provider: Provider): Promise<ResolvedIntegration> {
  const row = await loadRow(provider)
  const env = ENV[provider]

  let token: string | undefined
  let tokenSource: ResolvedIntegration["tokenSource"] = "none"
  let tokenUnreadable = false
  if (row?.token_ciphertext) {
    try {
      token = open(row.token_ciphertext)
      tokenSource = "admin"
    } catch (e) {
      tokenUnreadable = true
      console.error(`[integrations] ${provider}`, e instanceof SecretBoxError ? e.message : "jeton illisible")
    }
  }
  if (!token && env.token()) {
    token = env.token()
    tokenSource = "vercel"
  }

  const pixelId = row?.pixel_id || env.pixel() || undefined
  const pixelSource: ResolvedIntegration["pixelSource"] = row?.pixel_id ? "admin" : pixelId ? "vercel" : "none"
  const testEventCode = (row ? row.test_event_code : env.test()) || undefined

  return {
    enabled: row ? row.enabled : true,
    pixelId,
    token,
    testEventCode,
    pixelSource,
    tokenSource,
    tokenUnreadable,
  }
}

/** Identifiants publics des pixels pour le navigateur (après consentement). */
export async function publicPixelIds(): Promise<{ meta: string | null; tiktok: string | null }> {
  const [meta, tiktok] = await Promise.all(PROVIDERS.map(resolveIntegration))
  return {
    meta: meta.enabled && meta.pixelId ? meta.pixelId : null,
    tiktok: tiktok.enabled && tiktok.pixelId ? tiktok.pixelId : null,
  }
}

// ---------- validation des saisies ----------
export const RULES = {
  meta: {
    pixel: /^\d{15,17}$/,
    pixelHelp: "15 à 17 chiffres (Gestionnaire d'événements > Sources de données).",
    token: /^EAA[A-Za-z0-9]{90,600}$/,
    tokenHelp: "Commence par « EAA », au moins 100 caractères, sans espace ni guillemet.",
  },
  tiktok: {
    pixel: /^[A-Z0-9]{15,25}$/,
    pixelHelp: "Code du pixel TikTok (ex. C1A2B3…), lettres majuscules et chiffres.",
    token: /^[A-Za-z0-9]{30,128}$/,
    tokenHelp: "Jeton de l'Events API (lettres et chiffres, au moins 30 caractères).",
  },
} as const

export interface IntegrationInput {
  enabled: boolean
  pixelId: string
  token: string // vide = garder le jeton enregistré
  clearToken: boolean
  testEventCode: string
}

export function validateInput(provider: Provider, input: IntegrationInput): Record<string, string> {
  const r = RULES[provider]
  const errors: Record<string, string> = {}
  if (input.pixelId && !r.pixel.test(input.pixelId)) errors.pixelId = r.pixelHelp
  if (input.token && !r.token.test(input.token)) errors.token = r.tokenHelp
  if (input.testEventCode && !/^[A-Za-z0-9_-]{1,64}$/.test(input.testEventCode)) errors.testEventCode = "Lettres, chiffres, - ou _ (64 caractères max)."
  return errors
}

export interface Actor {
  id: string | null
  label: string
}

/** Enregistre un réglage. Le jeton est chiffré ; le journal ne contient jamais de valeur. */
export async function saveIntegration(provider: Provider, input: IntegrationInput, actor: Actor): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const clean: IntegrationInput = {
    enabled: input.enabled,
    pixelId: input.pixelId.trim(),
    token: input.token.trim(),
    clearToken: input.clearToken,
    testEventCode: input.testEventCode.trim(),
  }
  const errors = validateInput(provider, clean)
  if (Object.keys(errors).length) return { ok: false, errors }

  cache.delete(provider)
  const before = await loadRow(provider)
  const row: Record<string, unknown> = {
    provider,
    enabled: clean.enabled,
    pixel_id: clean.pixelId || null,
    test_event_code: clean.testEventCode || null,
    updated_at: new Date().toISOString(),
    updated_by: actor.id,
  }
  if (clean.token) {
    row.token_ciphertext = seal(clean.token)
    row.token_last4 = clean.token.slice(-4)
  } else if (clean.clearToken) {
    row.token_ciphertext = null
    row.token_last4 = null
  }

  const changed: string[] = []
  if ((before?.enabled ?? null) !== clean.enabled) changed.push(clean.enabled ? "activée" : "désactivée")
  if ((before?.pixel_id ?? "") !== clean.pixelId) changed.push("ID du pixel")
  if (clean.token) changed.push("jeton remplacé")
  else if (clean.clearToken && before?.token_ciphertext) changed.push("jeton supprimé")
  if ((before?.test_event_code ?? "") !== clean.testEventCode) changed.push("code de test")

  await upsertQuiet("landing_integrations", row, "provider")
  cache.delete(provider)
  await insertQuiet("landing_integration_changes", {
    provider,
    actor_id: actor.id,
    actor_label: actor.label.slice(0, 320),
    summary: (changed.length ? changed.join(", ") : "enregistré sans changement").slice(0, 300),
  }).catch(() => console.error("[integrations] journal non écrit"))
  return { ok: true }
}

// ---------- test de connexion ----------
export async function testIntegration(provider: Provider, actor: Actor): Promise<{ ok: boolean; message: string }> {
  cache.delete(provider)
  const cfg = await resolveIntegration(provider)
  let result: { ok: boolean; message: string }
  if (cfg.tokenUnreadable && !cfg.token) result = { ok: false, message: "Jeton enregistré illisible : ressaisissez-le." }
  else if (!cfg.pixelId) result = { ok: false, message: "ID du pixel manquant." }
  else if (!cfg.token) result = { ok: false, message: "Jeton d'accès manquant." }
  else result = provider === "meta" ? await testMeta(cfg.pixelId, cfg.token) : await testTikTok(cfg.pixelId, cfg.token, cfg.testEventCode)

  const message = `${result.message}${cfg.tokenSource === "vercel" ? " (jeton lu dans Vercel)" : ""}`.slice(0, 300)
  await upsertQuiet(
    "landing_integrations",
    { provider, enabled: cfg.enabled, last_test_at: new Date().toISOString(), last_test_ok: result.ok, last_test_message: message },
    "provider"
  ).catch(() => console.error("[integrations] résultat du test non enregistré"))
  await insertQuiet("landing_integration_changes", {
    provider,
    actor_id: actor.id,
    actor_label: actor.label.slice(0, 320),
    summary: `test : ${result.ok ? "réussi" : "échec"}`,
  }).catch(() => undefined)
  cache.delete(provider)
  return { ok: result.ok, message }
}

// Lecture du pixel avec le jeton (aucun événement envoyé) : valide jeton + accès au pixel.
async function testMeta(pixelId: string, token: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}?fields=id,name`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    const json = (await res.json().catch(() => ({}))) as { id?: string; name?: string; error?: { message?: string; code?: number } }
    if (res.ok && json.id) return { ok: true, message: `Connecté au pixel « ${json.name || json.id} ».` }
    const code = json.error?.code
    if (code === 190) return { ok: false, message: "Jeton invalide ou expiré (Meta code 190) : générez-en un nouveau." }
    if (code === 100 || code === 803) return { ok: false, message: "Pixel introuvable ou non accessible avec ce jeton." }
    return { ok: false, message: `Meta a refusé la connexion${code ? ` (code ${code})` : ""}.` }
  } catch {
    return { ok: false, message: "Meta injoignable depuis le serveur." }
  }
}

// Événement de test (avec code de test : n'apparaît que dans l'outil de test TikTok).
async function testTikTok(pixelId: string, token: string, testEventCode?: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": token },
      body: JSON.stringify({
        event_source: "web",
        event_source_id: pixelId,
        test_event_code: testEventCode || "E2BTEST",
        data: [{ event: "ViewContent", event_time: Math.floor(Date.now() / 1000), event_id: `test-${Date.now()}`, page: { url: "https://landingpage-easy2book.vercel.app/" } }],
      }),
      cache: "no-store",
    })
    const json = (await res.json().catch(() => ({}))) as { code?: number; message?: string }
    if (res.ok && json.code === 0) return { ok: true, message: "Événement de test accepté par TikTok." }
    return { ok: false, message: `TikTok a refusé l'événement${json.code !== undefined ? ` (code ${json.code})` : ""}.` }
  } catch {
    return { ok: false, message: "TikTok injoignable depuis le serveur." }
  }
}

// ---------- vue pour l'écran /admin/integrations (jamais de jeton en clair) ----------
export interface IntegrationView {
  provider: Provider
  migrationApplied: boolean
  enabled: boolean
  pixelId: string
  testEventCode: string
  tokenLast4: string | null
  tokenUnreadable: boolean
  vercelPixel: boolean
  vercelToken: boolean
  effective: { pixelSource: string; tokenSource: string }
  lastTest: { at: string; ok: boolean; message: string } | null
  history: { created_at: string; actor_label: string; summary: string }[]
}

export async function integrationViews(): Promise<IntegrationView[]> {
  let migrationApplied = true
  try {
    await select("landing_integrations", "select=provider&limit=1")
  } catch {
    migrationApplied = false
  }
  resetIntegrationCache()
  return Promise.all(
    PROVIDERS.map(async (provider) => {
      const row = migrationApplied ? await loadRow(provider) : null
      const eff = await resolveIntegration(provider)
      let tokenUnreadable = false
      if (row?.token_ciphertext) {
        try {
          open(row.token_ciphertext)
        } catch {
          tokenUnreadable = true
        }
      }
      const history = migrationApplied
        ? await select<{ created_at: string; actor_label: string; summary: string }>(
            "landing_integration_changes",
            `select=created_at,actor_label,summary&provider=eq.${provider}&order=created_at.desc&limit=8`
          ).catch(() => [])
        : []
      return {
        provider,
        migrationApplied,
        enabled: row ? row.enabled : true,
        pixelId: row?.pixel_id ?? "",
        testEventCode: row?.test_event_code ?? "",
        tokenLast4: row?.token_last4 ?? null,
        tokenUnreadable,
        vercelPixel: Boolean(ENV[provider].pixel()),
        vercelToken: Boolean(ENV[provider].token()),
        effective: { pixelSource: eff.pixelSource, tokenSource: eff.tokenSource },
        lastTest: row?.last_test_at ? { at: row.last_test_at, ok: Boolean(row.last_test_ok), message: row.last_test_message ?? "" } : null,
        history,
      }
    })
  )
}
