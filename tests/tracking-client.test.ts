// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { handleWhatsAppClick, trackEvent } from "@/lib/tracking"
import { setConsent } from "@/lib/consent"

function stubs() {
  const fbq = vi.fn()
  const ttq = { track: vi.fn() }
  const fetchMock = vi.fn(async () => new Response("{}"))
  Object.assign(window, { fbq, ttq })
  vi.stubGlobal("fetch", fetchMock)
  return { fbq, ttq, fetchMock }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  document.cookie.split(";").forEach((c) => (document.cookie = c.split("=")[0] + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"))
})

describe("trackEvent (navigateur)", () => {
  it("sans consentement : aucun appel Meta, TikTok ni serveur", () => {
    const { fbq, ttq, fetchMock } = stubs()
    trackEvent("Contact", { product: "omra" })
    expect(fbq).not.toHaveBeenCalled()
    expect(ttq.track).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("avec consentement : même event_id pour fbq (eventID), ttq (event_id) et /api/track", () => {
    setConsent("granted")
    const { fbq, ttq, fetchMock } = stubs()
    const id = trackEvent("Contact", { product: "omra", content_name: "header" })
    expect(fbq).toHaveBeenCalledWith("track", "Contact", expect.objectContaining({ product: "omra" }), { eventID: id })
    expect(ttq.track).toHaveBeenCalledWith("Contact", expect.any(Object), { event_id: id })
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(sent).toMatchObject({ eventName: "Contact", eventId: id, consent: "granted" })
  })

  it("Lead : pixel navigateur seul (le serveur l'envoie via /api/leads avec le même id)", () => {
    setConsent("granted")
    const { fbq, ttq, fetchMock } = stubs()
    trackEvent("Lead", { product: "hotel" }, { eventId: "lead-evt-0001", skipServer: true })
    expect(fbq).toHaveBeenCalledWith("track", "Lead", expect.any(Object), { eventID: "lead-evt-0001" })
    expect(ttq.track).toHaveBeenCalledWith("SubmitForm", expect.any(Object), { event_id: "lead-evt-0001" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("événement non standard : trackCustom avec eventID", () => {
    setConsent("granted")
    const { fbq } = stubs()
    const id = trackEvent("ScrollDepth", { depth: "50%" })
    expect(fbq).toHaveBeenCalledWith("trackCustom", "ScrollDepth", expect.any(Object), { eventID: id })
  })

  it("refus : supprime les identifiants publicitaires posés", () => {
    setConsent("granted")
    document.cookie = "_fbc=fb.1.1.X; path=/"
    localStorage.setItem("e2b_vid", "v")
    setConsent("denied")
    expect(document.cookie).not.toContain("_fbc=fb")
    expect(localStorage.getItem("e2b_vid")).toBeNull()
  })
})

describe("handleWhatsAppClick", () => {
  it("ajoute la référence visiteur au message, même sans consentement (donnée interne)", () => {
    const { fbq } = stubs()
    const a = document.createElement("a")
    a.href = "https://wa.me/21698140514?text=" + encodeURIComponent("Bonjour")
    handleWhatsAppClick({ currentTarget: a }, { product: "omra", location: "test" })
    const text = new URL(a.href).searchParams.get("text")!
    expect(text).toMatch(/^Bonjour\n\nRéf: E2B-[2-9A-HJ-NP-Z]{6}$/)
    expect(fbq).not.toHaveBeenCalled()
  })

  it("n'ajoute pas deux fois la référence", () => {
    stubs()
    const a = document.createElement("a")
    a.href = "https://wa.me/21698140514?text=Bonjour"
    handleWhatsAppClick({ currentTarget: a }, { product: "omra", location: "test" })
    handleWhatsAppClick({ currentTarget: a }, { product: "omra", location: "test" })
    expect(new URL(a.href).searchParams.get("text")!.match(/Réf:/g)).toHaveLength(1)
  })
})
