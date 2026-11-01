// Codes promo (réglés dans /admin/promos). Vérifiés à l'envoi du formulaire, enregistrés sur le lead ;
// la remise est appliquée par l'équipe au moment de la réservation.
import { insertOne, rpc, select, update } from "./db"
import type { Product } from "@/lib/config"

export interface PromoRow {
  id: number
  code: string
  title: string
  discount_type: "percent" | "amount"
  discount_value: number | string
  product: Product | null
  starts_on: string | null
  ends_on: string | null
  max_uses: number | null
  used_count: number
  active: boolean
  created_at: string
}

export type PromoStatus = "active" | "scheduled" | "expired" | "exhausted" | "disabled"

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis" }).format(new Date())

export function promoStatus(p: PromoRow, day = today()): PromoStatus {
  if (!p.active) return "disabled"
  if (p.ends_on && p.ends_on < day) return "expired"
  if (p.max_uses !== null && p.used_count >= p.max_uses) return "exhausted"
  if (p.starts_on && p.starts_on > day) return "scheduled"
  return "active"
}

export const normalizeCode = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, "")
export const CODE_RE = /^[A-Z0-9_-]{3,32}$/

export function discountLabel(p: Pick<PromoRow, "discount_type" | "discount_value">): string {
  const v = Number(p.discount_value)
  return p.discount_type === "percent" ? `-${v} %` : `-${v} TND`
}

/** Vérification sans consommer le code (avant l'enregistrement du lead). */
export async function findUsablePromo(raw: string, product: Product): Promise<PromoRow | null> {
  const code = normalizeCode(raw)
  if (!CODE_RE.test(code)) return null
  const [row] = await select<PromoRow>("landing_promo_codes", `select=*&code=eq.${encodeURIComponent(code)}&limit=1`)
  if (!row || promoStatus(row) !== "active") return null
  if (row.product && row.product !== product) return null
  return row
}

/** Consomme une utilisation (atomique en base) après l'enregistrement du lead. */
export async function redeemPromo(code: string, product: Product): Promise<boolean> {
  const rows = await rpc<unknown[]>("landing_redeem_promo", { p_code: code, p_product: product })
  return Array.isArray(rows) && rows.length > 0
}

export interface PromoInput {
  code: string
  title: string
  discountType: string
  discountValue: string
  product: string
  startsOn: string
  endsOn: string
  maxUses: string
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function validatePromo(i: PromoInput): { row?: Record<string, unknown>; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const code = normalizeCode(i.code)
  if (!CODE_RE.test(code)) errors.code = "3 à 32 caractères : lettres, chiffres, - ou _."
  const title = i.title.trim()
  if (title.length < 2 || title.length > 120) errors.title = "Titre requis (120 caractères max)."
  const type = i.discountType === "amount" ? "amount" : i.discountType === "percent" ? "percent" : null
  if (!type) errors.discountType = "Type invalide."
  const value = Number(i.discountValue.replace(",", "."))
  if (!(value > 0) || (type === "percent" && value > 100)) errors.discountValue = type === "percent" ? "Entre 1 et 100 %." : "Montant positif."
  const product = ["omra", "voyage", "hotel", "autre"].includes(i.product) ? i.product : null
  const startsOn = DAY.test(i.startsOn) ? i.startsOn : null
  const endsOn = DAY.test(i.endsOn) ? i.endsOn : null
  if (startsOn && endsOn && endsOn < startsOn) errors.endsOn = "La fin doit suivre le début."
  const maxUses = i.maxUses.trim() ? parseInt(i.maxUses, 10) : null
  if (maxUses !== null && !(maxUses > 0)) errors.maxUses = "Nombre positif ou vide (illimité)."
  if (Object.keys(errors).length) return { errors }
  return { errors, row: { code, title, discount_type: type, discount_value: value, product, starts_on: startsOn, ends_on: endsOn, max_uses: maxUses } }
}

export async function createPromo(i: PromoInput, actorId: string | null): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const { row, errors } = validatePromo(i)
  if (!row) return { ok: false, errors }
  try {
    await insertOne("landing_promo_codes", { ...row, updated_by: actorId })
  } catch (e) {
    if ((e as { isUniqueViolation?: boolean }).isUniqueViolation) return { ok: false, errors: { code: "Ce code existe déjà." } }
    throw e
  }
  return { ok: true }
}

export async function setPromoActive(id: number, active: boolean, actorId: string | null) {
  await update("landing_promo_codes", `id=eq.${id}`, { active, updated_at: new Date().toISOString(), updated_by: actorId })
}

export async function listPromos(): Promise<PromoRow[] | null> {
  return select<PromoRow>("landing_promo_codes", "select=*&order=created_at.desc&limit=500").catch(() => null)
}
