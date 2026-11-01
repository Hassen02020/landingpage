import { afterEach, describe, expect, it, vi } from "vitest"
import { sendMetaEvent } from "@/lib/server/meta"
import { sendTikTokEvent } from "@/lib/server/tiktok"
import { sha256 } from "@/lib/server/hash"
import { configureAll, installFetchMock } from "./helpers"

const event = {
  eventName: "Lead",
  eventId: "evt-12345678",
  pageUrl: "https://landing.test/omra",
  customData: { product: "omra", value: 1, currency: "TND" },
  user: { visitorId: "v1", phone: "21698140514", firstName: "Ahmed", ip: "1.2.3.4", userAgent: "ua", fbc: "fb.1.1.FB", ttclid: "TT" },
}

afterEach(() => vi.unstubAllEnvs())

describe("Meta Conversions API", () => {
  it("ne fait rien sans jeton", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", "")
    const f = installFetchMock()
    expect(await sendMetaEvent(event)).toEqual({ ok: false, skipped: true })
    expect(f.calls).toHaveLength(0)
  })

  it("envoie event_id, données hachées, et le jeton dans le corps (pas dans l'URL)", async () => {
    configureAll()
    const f = installFetchMock()
    await sendMetaEvent(event)
    const [call] = f.meta()
    expect(call.url).toBe("https://graph.facebook.com/v21.0/111/events")
    expect(call.url).not.toContain("meta-test-token")
    expect(call.body.access_token).toBe("meta-test-token")
    const d = call.body.data[0]
    expect(d.event_name).toBe("Lead")
    expect(d.event_id).toBe("evt-12345678")
    expect(d.user_data.ph).toEqual([sha256("21698140514")])
    expect(d.user_data.fn).toEqual([sha256("ahmed")])
    expect(d.user_data.external_id).toEqual([sha256("v1")])
    expect(JSON.stringify(call.body)).not.toContain("21698140514")
  })
})

describe("TikTok Events API", () => {
  it("convertit Lead en SubmitForm avec le même event_id", async () => {
    configureAll()
    const f = installFetchMock()
    await sendTikTokEvent(event)
    const [call] = f.tiktok()
    expect((call.init.headers as Record<string, string>)["Access-Token"]).toBe("tt-test-token")
    expect(call.body.event_source_id).toBe("TTPIXEL")
    expect(call.body.data[0].event).toBe("SubmitForm")
    expect(call.body.data[0].event_id).toBe("evt-12345678")
    expect(call.body.data[0].user.phone).toBe(sha256("+21698140514"))
    expect(call.body.data[0].user.ttclid).toBe("TT")
  })

  it("ignore les événements sans équivalent TikTok", async () => {
    configureAll()
    const f = installFetchMock()
    expect(await sendTikTokEvent({ ...event, eventName: "ScrollDepth" })).toEqual({ ok: false, skipped: true })
    expect(f.calls).toHaveLength(0)
  })
})
