import { describe, expect, it } from "vitest"
import { normalizePhone, sha256, randomRef } from "@/lib/server/hash"

describe("normalizePhone", () => {
  it.each([
    ["98140514", "21698140514"],
    ["98 140 514", "21698140514"],
    ["+216 98 140 514", "21698140514"],
    ["0021622123456", "21622123456"],
    ["71123456", "21671123456"],
    ["+33612345678", "33612345678"],
  ])("accepte %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it.each(["", "123", "18140514", "981405145", "abcdefgh", "33612345678", "+12"])("refuse %s", (input) => {
    expect(normalizePhone(input)).toBeNull()
  })
})

describe("sha256 / randomRef", () => {
  it("hache en minuscules sans espaces (exigence Meta)", () => {
    expect(sha256("  TN ")).toBe(sha256("tn"))
    expect(sha256("tn")).toMatch(/^[a-f0-9]{64}$/)
  })
  it("génère une référence E2B-XXXXXX", () => {
    expect(randomRef()).toMatch(/^E2B-[2-9A-HJ-NP-Z]{6}$/)
  })
})
