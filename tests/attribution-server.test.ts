import { describe, expect, it } from "vitest"
import { flattenAttribution } from "@/lib/server/attribution"

describe("flattenAttribution", () => {
  it("privilégie le dernier contact et garde le premier canal", () => {
    const a = flattenAttribution({
      visitor_id: "v1",
      ref: "E2B-ABC234",
      first_touch: { channel: "tiktok", utm_source: "tiktok", utm_campaign: "c1", ttclid: "TT1" },
      last_touch: { channel: "meta", utm_source: "facebook", utm_campaign: "c2", fbclid: "FB1", landing_page: "/omra" },
    })
    expect(a.channel).toBe("meta")
    expect(a.utm_campaign).toBe("c2")
    expect(a.first_channel).toBe("tiktok")
    expect(a.ttclid).toBe("TT1")
    expect(a.landing_page).toBe("/omra")
  })

  it("rejette une référence mal formée et tronque les valeurs longues", () => {
    const a = flattenAttribution({ ref: "<script>", last_touch: { utm_campaign: "x".repeat(1000) } })
    expect(a.ref).toBeUndefined()
    expect(a.utm_campaign).toHaveLength(255)
  })

  it("ignore une entrée qui n'est pas un objet", () => {
    expect(flattenAttribution("n'importe quoi")).toMatchObject({ visitor_id: undefined, channel: undefined })
  })
})
