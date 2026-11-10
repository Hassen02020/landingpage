import { describe, it, expect } from "vitest"
import { createHmac } from "node:crypto"
import { metaChallenge, verifyMetaSignature, verifyTimestampedHmac } from "../lib/server/webhook-auth"

const SECRET = "app-secret-de-test-0123456789"
const sign = (body: string, secret = SECRET) => "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex")

// NB : toutes les charges de ce fichier sont SIMULÉES (aucune plateforme réelle n'a été contactée).
describe("signature Meta (X-Hub-Signature-256)", () => {
  const body = JSON.stringify({ object: "page", entry: [{ id: "1", changes: [{ field: "leadgen", value: { leadgen_id: "123" } }] }] })
  it("accepte la bonne signature du corps brut", () => {
    expect(verifyMetaSignature(body, sign(body), SECRET)).toBe(true)
  })
  it("refuse un corps modifié, un autre secret, une signature absente ou mal formée", () => {
    expect(verifyMetaSignature(body + " ", sign(body), SECRET)).toBe(false)
    expect(verifyMetaSignature(body, sign(body, "autre-secret-0123456789012345"), SECRET)).toBe(false)
    expect(verifyMetaSignature(body, null, SECRET)).toBe(false)
    expect(verifyMetaSignature(body, "sha256=zz", SECRET)).toBe(false)
    expect(verifyMetaSignature(body, "sha1=" + "a".repeat(40), SECRET)).toBe(false)
    expect(verifyMetaSignature(body, sign(body), "")).toBe(false)
  })
})

describe("vérification d'abonnement Meta (GET)", () => {
  const q = (o: Record<string, string>) => new URLSearchParams(o)
  it("renvoie le challenge si le mode et le jeton sont bons", () => {
    expect(metaChallenge(q({ "hub.mode": "subscribe", "hub.verify_token": "jeton-secret", "hub.challenge": "1158201444" }), "jeton-secret")).toBe("1158201444")
  })
  it("refuse un mauvais jeton, un mauvais mode, un jeton attendu vide ou un challenge suspect", () => {
    expect(metaChallenge(q({ "hub.mode": "subscribe", "hub.verify_token": "x", "hub.challenge": "1" }), "jeton-secret")).toBeNull()
    expect(metaChallenge(q({ "hub.mode": "unsubscribe", "hub.verify_token": "jeton-secret", "hub.challenge": "1" }), "jeton-secret")).toBeNull()
    expect(metaChallenge(q({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1" }), "")).toBeNull()
    expect(metaChallenge(q({ "hub.mode": "subscribe", "hub.verify_token": "jeton-secret", "hub.challenge": "<script>" }), "jeton-secret")).toBeNull()
  })
})

describe("signature horodatée générique (anti-rejeu)", () => {
  const body = '{"lead_id":"L1"}'
  const ts = "1794350000"
  const sig = (t: string, b = body, s = SECRET) => createHmac("sha256", s).update(`${t}.${b}`, "utf8").digest("hex")
  it("accepte une signature récente et correcte", () => {
    expect(verifyTimestampedHmac({ rawBody: body, timestamp: ts, signature: sig(ts), secret: SECRET, nowSeconds: 1794350100 })).toBe(true)
  })
  it("accepte un horodatage en millisecondes", () => {
    const ms = "1794350000000"
    expect(verifyTimestampedHmac({ rawBody: body, timestamp: ms, signature: sig(ms), secret: SECRET, nowSeconds: 1794350050 })).toBe(true)
  })
  it("refuse un rejeu trop ancien, un horodatage futur excessif, un corps ou un secret différent", () => {
    expect(verifyTimestampedHmac({ rawBody: body, timestamp: ts, signature: sig(ts), secret: SECRET, nowSeconds: 1794350000 + 3600 })).toBe(false)
    expect(verifyTimestampedHmac({ rawBody: body, timestamp: ts, signature: sig(ts), secret: SECRET, nowSeconds: 1794350000 - 3600 })).toBe(false)
    expect(verifyTimestampedHmac({ rawBody: body + "x", timestamp: ts, signature: sig(ts), secret: SECRET, nowSeconds: 1794350010 })).toBe(false)
    expect(verifyTimestampedHmac({ rawBody: body, timestamp: ts, signature: sig(ts, body, "autre-secret-0123456789012345"), secret: SECRET, nowSeconds: 1794350010 })).toBe(false)
  })
  it("refuse les valeurs absentes ou mal formées", () => {
    expect(verifyTimestampedHmac({ rawBody: body, timestamp: "abc", signature: sig(ts), secret: SECRET })).toBe(false)
    expect(verifyTimestampedHmac({ rawBody: body, timestamp: ts, signature: "zz", secret: SECRET })).toBe(false)
    expect(verifyTimestampedHmac({ rawBody: body, timestamp: null, signature: sig(ts), secret: SECRET })).toBe(false)
  })
})
