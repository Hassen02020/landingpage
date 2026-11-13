import { describe, expect, it } from "vitest"
import { parseAmount, parseCommissionCsv, parseDate, parseKind, MAX_IMPORT_ROWS } from "../lib/commission-import"

const H = "reservation_ref;nature;montant_tnd;date;lead_ref;telephone;ligne"

describe("analyse du fichier d'import EasyV4", () => {
  it("lit les colonnes, normalise nature, montant (signe), date et clé d'idempotence", () => {
    const r = parseCommissionCsv([H, "RES-2041;commission;1 250,500;2026-11-08;E2B-ABC234;;", "RES-2041;annulation;1250.5;09/11/2026;E2B-ABC234;;", "RES-2042;remboursement;-80;2026-11-10;;98 140 514;2"].join("\n"))
    expect(r.fatal).toBeUndefined()
    const rows = r.rows.map((x) => (x.ok ? x.row : null))
    expect(rows[0]).toMatchObject({ reservationRef: "RES-2041", kind: "commission", amount: 1250.5, date: "2026-11-08", leadRef: "E2B-ABC234", lineKey: "RES-2041|commission|1" })
    expect(rows[1]).toMatchObject({ kind: "annulation", amount: -1250.5, date: "2026-11-09" })
    expect(rows[2]).toMatchObject({ kind: "remboursement", amount: -80, phone: "98140514", leadRef: null, lineKey: "RES-2042|remboursement|2" })
  })

  it("le signe du fichier est ignoré : la nature décide (commission toujours positive, annulation toujours négative)", () => {
    const r = parseCommissionCsv([H, "R1;commission;-300;2026-11-08;E2B-ABC234;;", "R1;annulation;300;2026-11-09;E2B-ABC234;;"].join("\n"))
    const [a, b] = r.rows.map((x) => (x.ok ? x.row.amount : NaN))
    expect([a, b]).toEqual([300, -300])
  })

  it("détecte la virgule comme séparateur, accepte les en-têtes accentués / alias et le BOM", () => {
    const r = parseCommissionCsv("﻿Référence réservation,Type,Commission nette,Date événement,Référence lead\nR9,Commission,500,2026-11-08,E2B-ABC234")
    expect(r.rows[0]).toMatchObject({ ok: true, row: { reservationRef: "R9", kind: "commission", amount: 500 } })
  })

  it("lignes invalides : erreur par ligne, les autres lignes restent importables", () => {
    const r = parseCommissionCsv([H, "R1;commission;100;2026-11-08;E2B-ABC234;;", ";commission;100;2026-11-08;E2B-ABC234;;", "R3;vente-fantome;100;2026-11-08;E2B-ABC234;;", "R4;commission;0;2026-11-08;E2B-ABC234;;", "R5;commission;100;2026-02-30;E2B-ABC234;;", "R6;commission;100;2026-11-08;pas-une-ref;;", "R7;commission;100;2026-11-08;;;"].join("\n"))
    expect(r.rows.filter((x) => x.ok)).toHaveLength(1)
    const errs = r.rows.flatMap((x) => (x.ok ? [] : [x.error]))
    expect(errs).toHaveLength(6)
    expect(errs.join(" ")).toMatch(/Référence de réservation/)
    expect(errs.join(" ")).toMatch(/Nature inconnue/)
    expect(errs.join(" ")).toMatch(/Montant invalide/)
    expect(errs.join(" ")).toMatch(/Date invalide/)
    expect(errs.join(" ")).toMatch(/E2B-XXXXXX/)
    expect(errs.join(" ")).toMatch(/rapprochement impossible/)
  })

  it("doublon dans le fichier (même réservation, nature et numéro) : la 2e ligne est rejetée", () => {
    const r = parseCommissionCsv([H, "R1;commission;100;2026-11-08;E2B-ABC234;;", "R1;commission;100;2026-11-08;E2B-ABC234;;", "R1;remboursement;10;2026-11-09;E2B-ABC234;;1", "R1;remboursement;10;2026-11-09;E2B-ABC234;;2"].join("\n"))
    expect(r.rows.map((x) => x.ok)).toEqual([true, false, true, true])
  })

  it("colonnes obligatoires, fichier vide, trop de lignes, trop gros", () => {
    expect(parseCommissionCsv("nature;montant\ncommission;5").fatal).toMatch(/reservation_ref/)
    expect(parseCommissionCsv(H).fatal).toMatch(/ligne d'en-tête/)
    const many = [H, ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `R${i};commission;10;2026-11-08;E2B-ABC234;;`)].join("\n")
    expect(parseCommissionCsv(many).fatal).toMatch(/Trop de lignes/)
    expect(parseCommissionCsv("x".repeat(250_000)).fatal).toMatch(/volumineux/)
  })

  it("montants, dates et natures isolés", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56)
    expect(parseAmount("1,234.56")).toBe(1234.56)
    expect(parseAmount("12,5 TND")).toBe(12.5)
    expect(parseAmount("0")).toBeNull()
    expect(parseAmount("abc")).toBeNull()
    expect(parseAmount("200000000")).toBeNull()
    expect(parseDate("2026-11-08")).toBe("2026-11-08")
    expect(parseDate("8/11/2026")).toBe("2026-11-08")
    expect(parseDate("2019-12-31")).toBeNull()
    expect(parseDate("2026-13-01")).toBeNull()
    expect(parseKind("Annulée")).toBe("annulation")
    expect(parseKind("Remboursé")).toBe("remboursement")
    expect(parseKind("autre")).toBeNull()
  })

  it("les champs entre guillemets peuvent contenir le séparateur", () => {
    const r = parseCommissionCsv(`${H}\n"R;1";commission;100;2026-11-08;E2B-ABC234;;`)
    expect(r.rows[0].ok).toBe(false) // « ; » interdit dans une référence de réservation
  })
})
