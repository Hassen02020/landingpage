import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { hasEmoji, waText } from "@/lib/wa-text"
import { buildWhatsAppUrl } from "@/lib/tracking"
import { renderTemplate } from "@/lib/server/templates"

// Constaté le 06/11/2026 : wa.me remplace tout emoji par « � » (U+FFFD) dans sa redirection.
describe("textes WhatsApp préremplis : aucun emoji", () => {
  it("waText retire les emojis (y compris composés) et garde accents, arabe, tirets, retours à la ligne", () => {
    expect(waText("Bonjour Easy2Book 👋 je souhaite")).toBe("Bonjour Easy2Book je souhaite")
    expect(waText("Voyage ✈️ 🏖️ 👨‍👩‍👧 🇹🇳 1️⃣ fin")).toBe("Voyage fin")
    expect(waText("Réf: E2B-ABC123\n- Date\n- الفوج الثاني — 18 فيفري")).toBe("Réf: E2B-ABC123\n- Date\n- الفوج الثاني — 18 فيفري")
    expect(hasEmoji("é à ç — ٣ ✓")).toBe(false) // ✓ n'est pas un emoji
    expect(hasEmoji("ok 👋")).toBe(true)
  })

  it("buildWhatsAppUrl n'envoie jamais d'emoji, ni le caractère de remplacement", () => {
    const url = buildWhatsAppUrl("Bonjour 👋 test ✈️", "E2B-ABC123")
    const text = decodeURIComponent(new URL(url).searchParams.get("text")!)
    expect(hasEmoji(text)).toBe(false)
    expect(text).toContain("Réf: E2B-ABC123")
    expect(url).not.toMatch(/%F0%9F|%E2%9C%88/i)
  })

  it("les modèles d'équipe (emojis dans la migration 0005) sont nettoyés avant l'envoi", () => {
    const body = "Bonjour {prenom} 👋\nVotre demande {ref} 🔥"
    const out = waText(renderTemplate(body, { first_name: "Sami", last_name: null, ref: "E2B-ABC123", offer: null, product: "omra" }))
    expect(hasEmoji(out)).toBe(false)
    expect(out).toBe("Bonjour Sami\nVotre demande E2B-ABC123")
  })

  it("aucun texte prérempli du code source ne contient d'emoji (garde-fou)", () => {
    const files: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(f)) files.push(p)
      }
    }
    walk("app")
    walk("lib")
    const offenders: string[] = []
    for (const f of files) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        // lignes qui construisent un message prérempli (texte commençant par « Bonjour Easy2Book »)
        if (/Bonjour Easy2Book/.test(line) && hasEmoji(line)) offenders.push(`${f}:${i + 1}`)
      })
    }
    expect(offenders).toEqual([])
  })
})
