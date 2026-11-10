import { describe, it, expect } from "vitest"
import { measurementStatus, type StatusInput } from "../lib/integration-status"

const base: StatusInput = { provider: "meta", enabled: true, pixelId: "1674012850599992", pixelSource: "admin", tokenSource: "admin", tokenUnreadable: false, testEventCode: "" }

describe("état de la mesure (écran Intégrations)", () => {
  it("tout est en place : mesure active", () => {
    expect(measurementStatus(base).level).toBe("ok")
  })
  it("désactivée : aucun événement", () => {
    const s = measurementStatus({ ...base, enabled: false })
    expect(s.level).toBe("off")
    expect(s.detail).toMatch(/Aucun événement/)
  })
  it("code de test resté enregistré : avertissement (les conversions réelles ne comptent pas)", () => {
    const s = measurementStatus({ ...base, testEventCode: "TEST22222" })
    expect(s.level).toBe("warn")
    expect(s.title).toMatch(/Mode test/)
    expect(s.detail).toMatch(/Videz/)
  })
  it("le code de test prime sur le reste (même sans jeton)", () => {
    expect(measurementStatus({ ...base, tokenSource: "none", testEventCode: "TEST1" }).title).toMatch(/Mode test/)
  })
  it("sans pixel : avertissement", () => {
    expect(measurementStatus({ ...base, pixelId: "", pixelSource: "none" }).level).toBe("warn")
  })
  it("sans jeton : pixel navigateur seul", () => {
    const s = measurementStatus({ ...base, tokenSource: "none" })
    expect(s.level).toBe("warn")
    expect(s.title).toMatch(/navigateur seul/)
  })
  it("jeton illisible : avertissement", () => {
    expect(measurementStatus({ ...base, tokenUnreadable: true }).title).toMatch(/illisible/)
  })
  it("TikTok : le nom du fournisseur est correct", () => {
    expect(measurementStatus({ ...base, provider: "tiktok", enabled: false }).detail).toMatch(/TikTok/)
  })
})
