import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/track/route"
import { __resetGuards } from "@/lib/server/guard"
import { configureAll, installFetchMock, post } from "./helpers"

const body = {
  eventName: "Contact",
  eventId: "track-evt-0001",
  customData: { product: "omra", value: 4800, currency: "TND", "<script>": "x", nested: { a: 1 } },
  attribution: { visitor_id: "v1", fbp: "fb.1.1.123", last_touch: { channel: "meta" } },
  consent: "granted",
}

beforeEach(() => {
  __resetGuards()
  configureAll()
})
afterEach(() => vi.unstubAllEnvs())

describe("POST /api/track", () => {
  it("relaie vers Meta et TikTok avec le même event_id que le pixel", async () => {
    const f = installFetchMock()
    const res = await POST(post("/api/track", body))
    expect(await res.json()).toEqual({ ok: true, forwarded: true })
    expect(f.meta()[0].body.data[0]).toMatchObject({ event_name: "Contact", event_id: "track-evt-0001" })
    expect(f.meta()[0].body.data[0].user_data.fbp).toBe("fb.1.1.123")
    expect(f.tiktok()[0].body.data[0]).toMatchObject({ event: "Contact", event_id: "track-evt-0001" })
  })

  it("journalise les clics (visiteur consentant) dans landing_events", async () => {
    const f = installFetchMock()
    await POST(post("/api/track", { ...body, customData: { ...body.customData, niche: "omra-ete", content_ids: "foj1" } }))
    expect(f.db.landing_events).toHaveLength(1)
    expect(f.db.landing_events[0]).toMatchObject({ event_name: "Contact", event_id: "track-evt-0001", visitor_ref: null, product: "omra", niche: "omra-ete", offer: "foj1", channel: "meta" })
  })

  it("filtre les données personnalisées (clés invalides et objets)", async () => {
    const f = installFetchMock()
    await POST(post("/api/track", body))
    expect(f.meta()[0].body.data[0].custom_data).toEqual({ product: "omra", value: 4800, currency: "TND" })
  })

  it("n'envoie rien sans consentement", async () => {
    const f = installFetchMock()
    const res = await POST(post("/api/track", { ...body, consent: undefined }))
    expect(await res.json()).toEqual({ ok: true, forwarded: false })
    expect(f.calls).toHaveLength(0)
    expect(f.db.landing_events).toHaveLength(0)
  })

  it("refuse les événements hors liste (Lead, Purchase, arbitraire)", async () => {
    const f = installFetchMock()
    for (const eventName of ["Lead", "Purchase", "Anything"]) {
      expect((await POST(post("/api/track", { ...body, eventName }))).status).toBe(400)
    }
    expect(f.calls).toHaveLength(0)
  })

  it("ne relaie qu'une fois un même event_id", async () => {
    const f = installFetchMock()
    await POST(post("/api/track", body))
    const again = await (await POST(post("/api/track", body))).json()
    expect(again).toMatchObject({ forwarded: false, duplicate: true })
    expect(f.meta()).toHaveLength(1)
  })

  it("refuse une origine étrangère", async () => {
    const f = installFetchMock()
    expect((await POST(post("/api/track", body, { origin: "https://evil.example" }))).status).toBe(403)
    expect(f.calls).toHaveLength(0)
  })
})
