"use server"

// Actions des écrans Protection et Codes promo — rôle « admin » revérifié à chaque appel.
import { revalidatePath } from "next/cache"
import { currentStaff } from "@/lib/server/auth"
import { rateLimited } from "@/lib/server/guard"
import { block, setAllowedCountries, unblock, type BlockKind } from "@/lib/server/protection"
import { createPromo, setPromoActive } from "@/lib/server/promo"

export interface FormState {
  ok?: boolean
  message?: string
  errors?: Record<string, string>
}

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim()

async function requireAdmin() {
  const staff = await currentStaff()
  if (!staff || staff.role !== "admin") return null
  if (rateLimited(`settings:${staff.userId}`, 60, 10 * 60 * 1000)) return null
  return staff
}

const DENIED: FormState = { ok: false, message: "Réservé aux administrateurs (ou trop de modifications : réessayez plus tard)." }
const FAILED: FormState = { ok: false, message: "Enregistrement impossible (migration 0003 appliquée ?)." }

// ---------- protection ----------
export async function blockAction(_p: FormState | undefined, fd: FormData): Promise<FormState> {
  const staff = await requireAdmin()
  if (!staff) return DENIED
  const kind = field(fd, "kind") === "ip" ? "ip" : ("phone" as BlockKind)
  try {
    const res = await block(kind, field(fd, "value"), field(fd, "reason"), { id: staff.userId, label: staff.email })
    if (!res.ok) return { ok: false, message: res.error }
    revalidatePath("/admin/protection")
    return { ok: true, message: `${kind === "phone" ? "Numéro" : "IP"} bloqué : ${res.value}` }
  } catch {
    return FAILED
  }
}

export async function unblockAction(fd: FormData): Promise<void> {
  const staff = await requireAdmin()
  const id = parseInt(field(fd, "id"), 10)
  if (!staff || !(id > 0)) return
  await unblock(id, { id: staff.userId, label: staff.email }).catch(() => undefined)
  revalidatePath("/admin/protection")
}

export async function countriesAction(_p: FormState | undefined, fd: FormData): Promise<FormState> {
  const staff = await requireAdmin()
  if (!staff) return DENIED
  const codes = fd.getAll("countries").map(String)
  try {
    await setAllowedCountries(fd.get("all") === "on" ? [] : codes, { id: staff.userId, label: staff.email })
  } catch {
    return FAILED
  }
  revalidatePath("/admin/protection")
  return { ok: true, message: "Pays autorisés enregistrés (pris en compte en moins d'une minute)." }
}

/** Depuis la fiche d'un lead : bloquer son numéro. */
export async function blockLeadPhoneAction(fd: FormData): Promise<void> {
  const staff = await requireAdmin()
  if (!staff) return
  const phone = field(fd, "phone")
  await block("phone", `+${phone.replace(/^\+/, "")}`, `lead ${field(fd, "ref")}`.slice(0, 200), { id: staff.userId, label: staff.email }).catch(() => undefined)
  revalidatePath(`/admin/leads/${field(fd, "leadId")}`)
  revalidatePath("/admin/protection")
}

// ---------- codes promo ----------
export async function createPromoAction(_p: FormState | undefined, fd: FormData): Promise<FormState> {
  const staff = await requireAdmin()
  if (!staff) return DENIED
  try {
    const res = await createPromo(
      {
        code: field(fd, "code"),
        title: field(fd, "title"),
        discountType: field(fd, "discountType"),
        discountValue: field(fd, "discountValue"),
        product: field(fd, "product"),
        startsOn: field(fd, "startsOn"),
        endsOn: field(fd, "endsOn"),
        maxUses: field(fd, "maxUses"),
      },
      staff.userId
    )
    if (!res.ok) return { ok: false, errors: res.errors, message: "Vérifiez les champs signalés." }
  } catch {
    return FAILED
  }
  revalidatePath("/admin/promos")
  return { ok: true, message: "Code promo créé." }
}

export async function togglePromoAction(fd: FormData): Promise<void> {
  const staff = await requireAdmin()
  const id = parseInt(field(fd, "id"), 10)
  if (!staff || !(id > 0)) return
  await setPromoActive(id, field(fd, "active") === "true", staff.userId).catch(() => undefined)
  revalidatePath("/admin/promos")
}
