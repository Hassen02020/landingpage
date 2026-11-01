"use server"

// Actions de l'écran /admin/integrations — réservées au rôle « admin », revérifié à chaque appel.
import { revalidatePath } from "next/cache"
import { currentStaff } from "@/lib/server/auth"
import { rateLimited } from "@/lib/server/guard"
import { PROVIDERS, saveIntegration, testIntegration, type Provider } from "@/lib/server/integrations"

export interface IntegrationFormState {
  ok?: boolean
  message?: string
  errors?: Record<string, string>
}

async function requireAdmin() {
  const staff = await currentStaff()
  if (!staff || staff.role !== "admin") return null
  return staff
}

function providerOf(fd: FormData): Provider | null {
  const p = String(fd.get("provider") ?? "")
  return (PROVIDERS as string[]).includes(p) ? (p as Provider) : null
}

export async function saveIntegrationAction(_prev: IntegrationFormState | undefined, fd: FormData): Promise<IntegrationFormState> {
  const staff = await requireAdmin()
  if (!staff) return { ok: false, message: "Réservé aux administrateurs." }
  const provider = providerOf(fd)
  if (!provider) return { ok: false, message: "Intégration inconnue." }
  if (rateLimited(`integrations:${staff.userId}`, 20, 10 * 60 * 1000)) return { ok: false, message: "Trop de modifications. Réessayez dans quelques minutes." }

  try {
    const res = await saveIntegration(
      provider,
      {
        enabled: fd.get("enabled") === "on",
        pixelId: String(fd.get("pixelId") ?? ""),
        token: String(fd.get("token") ?? ""),
        clearToken: fd.get("clearToken") === "on",
        testEventCode: String(fd.get("testEventCode") ?? ""),
      },
      { id: staff.userId, label: staff.email }
    )
    if (!res.ok) return { ok: false, errors: res.errors, message: "Vérifiez les champs signalés." }
  } catch (e) {
    console.error("[integrations] enregistrement impossible", e instanceof Error ? e.message : "erreur")
    return { ok: false, message: "Enregistrement impossible (migration 0003 appliquée ?)." }
  }
  revalidatePath("/admin/integrations")
  return { ok: true, message: "Enregistré. Pris en compte par le site en moins d'une minute." }
}

export async function testIntegrationAction(_prev: IntegrationFormState | undefined, fd: FormData): Promise<IntegrationFormState> {
  const staff = await requireAdmin()
  if (!staff) return { ok: false, message: "Réservé aux administrateurs." }
  const provider = providerOf(fd)
  if (!provider) return { ok: false, message: "Intégration inconnue." }
  if (rateLimited(`integrations-test:${staff.userId}`, 10, 10 * 60 * 1000)) return { ok: false, message: "Trop de tests. Réessayez dans quelques minutes." }
  const res = await testIntegration(provider, { id: staff.userId, label: staff.email })
  revalidatePath("/admin/integrations")
  return res
}
