import { afterEach, describe, expect, it, vi } from "vitest"
import { insertQuiet } from "@/lib/server/db"
import { logActivity } from "@/lib/server/crm"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// Régression (production 01/11/2026 : « [leads] historique non écrit ») : PostgREST renvoie 201
// avec un corps vide pour Prefer: return=minimal ; l'ancien code appelait res.json() et échouait
// alors que la ligne était bien écrite.
describe("insertion « return=minimal »", () => {
  it("accepte une réponse 201 au corps vide", async () => {
    vi.stubEnv("LANDING_SUPABASE_URL", "https://landing-sb.test")
    vi.stubEnv("LANDING_SUPABASE_SERVICE_ROLE_KEY", "service-role-test")
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })))
    await expect(insertQuiet("landing_lead_activities", { a: 1 })).resolves.toBeUndefined()
    await expect(logActivity("00000000-0000-0000-0000-000000000001", { id: null, label: "système" }, "created")).resolves.toBeUndefined()
  })
})
