// Modèles de messages WhatsApp (/admin/modeles), utilisés en un clic sur la fiche d'un lead.
import { insertOne, insertQuiet, select, update } from "./db"
import { PRODUCTS, type Product } from "@/lib/config"

export interface Template {
  id: string
  title: string
  body: string
  product: Product | null
  position: number
  active: boolean
}

const UUID = /^[0-9a-f-]{36}$/i

export async function listTemplates(opts: { activeOnly?: boolean; product?: Product } = {}): Promise<Template[]> {
  const q = ["select=id,title,body,product,position,active", "order=position.asc,title.asc", "limit=100"]
  if (opts.activeOnly) q.push("active=eq.true")
  const rows = await select<Template>("landing_message_templates", q.join("&"))
  return opts.product ? rows.filter((t) => !t.product || t.product === opts.product) : rows
}

/** Remplace {prenom} {nom} {ref} {offre} {produit} ; les variables vides deviennent un texte neutre. */
export function renderTemplate(body: string, lead: { first_name: string; last_name: string | null; ref: string; offer: string | null; product: Product }): string {
  const values: Record<string, string> = {
    prenom: lead.first_name || "",
    nom: lead.last_name || "",
    ref: lead.ref,
    offre: lead.offer || PRODUCTS[lead.product],
    produit: PRODUCTS[lead.product],
  }
  return body.replace(/\{(prenom|nom|ref|offre|produit)\}/g, (_, k: string) => values[k]).replace(/[ \t]{2,}/g, " ")
}

export function validateTemplate(f: Record<string, string>): { row?: Record<string, unknown>; errors: Record<string, string> } {
  const e: Record<string, string> = {}
  const title = (f.title || "").trim()
  const body = (f.body || "").trim()
  if (title.length < 2 || title.length > 80) e.title = "Titre requis (80 caractères max)."
  if (body.length < 2 || body.length > 1500) e.body = "Message requis (1 500 caractères max)."
  const product = ["omra", "voyage", "hotel", "autre"].includes(f.product) ? f.product : null
  if (Object.keys(e).length) return { errors: e }
  return { errors: e, row: { title, body, product, position: parseInt(f.position || "0", 10) || 0, active: f.active === "on" } }
}

export async function saveTemplate(id: string | null, f: Record<string, string>, actor: { id: string; label: string }) {
  const { row, errors } = validateTemplate(f)
  if (!row) return { ok: false as const, errors }
  const stamp = { updated_at: new Date().toISOString(), updated_by: actor.id }
  if (id && UUID.test(id)) await update("landing_message_templates", `id=eq.${id}`, { ...row, ...stamp })
  else await insertOne("landing_message_templates", { ...row, ...stamp })
  await insertQuiet("landing_admin_log", { actor_id: actor.id, actor_label: actor.label.slice(0, 320), area: "modeles", summary: `${id ? "modifié" : "créé"} : ${String(row.title)}`.slice(0, 300) }).catch(() => undefined)
  return { ok: true as const }
}
