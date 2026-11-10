"use client"

import { useFormState, useFormStatus } from "react-dom"
import { saveIntegrationAction, testIntegrationAction, type IntegrationFormState } from "../../integrations-actions"
import type { IntegrationView } from "@/lib/server/integrations"
import { measurementStatus } from "@/lib/integration-status"

const META_INFO = {
  meta: {
    title: "Meta (Facebook / Instagram)",
    logo: "∞",
    color: "from-blue-100 to-blue-50 text-blue-600",
    pixelLabel: "ID du pixel",
    pixelPlaceholder: "ex. 1674012850599992",
    pixelHelp: "Gestionnaire d'événements > Sources de données > votre pixel : 15 à 17 chiffres (pas une adresse e-mail).",
    tokenLabel: "Jeton d'accès de l'API Conversions",
    tokenHelp: "Gestionnaire d'événements > Paramètres > API Conversions > Générer un jeton d'accès. Commence par « EAA ».",
    testHelp: "Onglet « Tester les événements » (ex. TEST12345). À vider après les essais : sinon les événements ne comptent pas.",
  },
  tiktok: {
    title: "TikTok",
    logo: "♪",
    color: "from-pink-100 to-rose-50 text-gray-900",
    pixelLabel: "ID du pixel",
    pixelPlaceholder: "ex. C1A2B3C4D5E6F7G8H9I0",
    pixelHelp: "TikTok Ads Manager > Outils > Événements > Web : code du pixel (majuscules et chiffres).",
    tokenLabel: "Jeton d'accès de l'Events API",
    tokenHelp: "Paramètres du pixel > Events API > Générer un jeton d'accès.",
    testHelp: "Onglet « Tester les événements » du pixel. À vider après les essais.",
  },
} as const

const SOURCE: Record<string, string> = { admin: "réglage /admin", vercel: "variable Vercel", none: "aucun" }

function Btn({ children, kind = "primary" }: { children: React.ReactNode; kind?: "primary" | "ghost" }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        kind === "primary"
          ? "bg-violet-700 hover:bg-violet-800 text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50"
          : "border border-gray-300 hover:bg-gray-50 font-bold px-4 py-2 rounded-xl disabled:opacity-50"
      }
    >
      {pending ? "…" : children}
    </button>
  )
}

function Message({ state }: { state?: IntegrationFormState }) {
  if (!state?.message) return null
  return (
    <div className={`p-3 rounded-xl text-sm border ${state.ok ? "bg-green-50 border-green-200 text-green-800" : state.inconclusive ? "bg-blue-50 border-blue-200 text-blue-900" : "bg-red-50 border-red-200 text-red-700"}`}>
      {state.message}
    </div>
  )
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Tunis" }).format(new Date(iso))

export function IntegrationCard({ view }: { view: IntegrationView }) {
  const info = META_INFO[view.provider]
  const [saveState, save] = useFormState(saveIntegrationAction, undefined)
  const [testState, test] = useFormState(testIntegrationAction, undefined)
  const input = "w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
  const err = (k: string) => saveState?.errors?.[k]

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className={`bg-gradient-to-br ${info.color} px-5 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-black w-10 text-center">{info.logo}</span>
          <div>
            <h2 className="font-black text-gray-900">{info.title}</h2>
            <p className="text-xs text-gray-600">Pixel navigateur + événements serveur (dédupliqués)</p>
          </div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${view.enabled ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>
          {view.enabled ? "Activée" : "Désactivée"}
        </span>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            Pixel utilisé : <strong>{SOURCE[view.effective.pixelSource]}</strong>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            Jeton utilisé : <strong>{SOURCE[view.effective.tokenSource]}</strong>
          </div>
        </div>

        {(() => {
          const st = measurementStatus({
            provider: view.provider,
            enabled: view.enabled,
            pixelId: view.pixelId,
            pixelSource: view.effective.pixelSource,
            tokenSource: view.effective.tokenSource,
            tokenUnreadable: view.tokenUnreadable,
            testEventCode: view.testEventCode,
          })
          const tone = st.level === "ok" ? "bg-green-50 border-green-200 text-green-900" : st.level === "warn" ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-gray-50 border-gray-200 text-gray-700"
          return (
            <div role="status" className={`rounded-xl border px-4 py-3 ${tone}`}>
              <div className="font-black text-sm">{st.level === "ok" ? "✓ " : st.level === "warn" ? "⚠ " : "○ "}{st.title}</div>
              <p className="text-xs mt-1">{st.detail}</p>
            </div>
          )
        })()}

        {view.lastTest && (
          <div className={`text-sm rounded-xl px-3 py-2 ${view.lastTest.ok === true ? "bg-green-50 text-green-800" : view.lastTest.ok === null ? "bg-blue-50 text-blue-900" : "bg-amber-50 text-amber-800"}`}>
            Dernier test ({fmtDate(view.lastTest.at)}) : {view.lastTest.ok === true ? "✓" : view.lastTest.ok === null ? "ℹ" : "✗"} {view.lastTest.message}
          </div>
        )}

        <form action={save} className="space-y-4">
          <input type="hidden" name="provider" value={view.provider} />
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" name="enabled" defaultChecked={view.enabled} className="w-4 h-4" />
            Activer cette intégration
          </label>

          <div>
            <label className="block text-sm font-bold mb-1">{info.pixelLabel}</label>
            <input name="pixelId" defaultValue={view.pixelId} placeholder={info.pixelPlaceholder} className={`${input} ${err("pixelId") ? "border-red-400" : ""}`} autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other" spellCheck={false} />
            <p className={`text-xs mt-1 ${err("pixelId") ? "text-red-600" : "text-gray-500"}`}>{err("pixelId") || info.pixelHelp}</p>
            {!view.pixelId && view.vercelPixel && <p className="text-xs text-gray-500">Vide : la valeur Vercel est utilisée.</p>}
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">{info.tokenLabel}</label>
            {view.tokenLast4 && (
              <p className={`text-xs mb-1 ${view.tokenUnreadable ? "text-red-600 font-bold" : "text-gray-600"}`}>
                {view.tokenUnreadable ? "Jeton enregistré illisible : ressaisissez-le." : `Jeton enregistré : ••••${view.tokenLast4}`}
              </p>
            )}
            <input
              name="token"
              type="password"
              placeholder={view.tokenLast4 ? "Laisser vide pour garder le jeton enregistré" : "Coller le jeton ici"}
              className={`${input} ${err("token") ? "border-red-400" : ""}`}
              autoComplete="new-password"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              spellCheck={false}
            />
            <p className={`text-xs mt-1 ${err("token") ? "text-red-600" : "text-gray-500"}`}>{err("token") || info.tokenHelp}</p>
            {view.tokenLast4 && (
              <label className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                <input type="checkbox" name="clearToken" /> Supprimer le jeton enregistré
              </label>
            )}
            {!view.tokenLast4 && view.vercelToken && <p className="text-xs text-gray-500">Aucun jeton ici : celui de Vercel est utilisé.</p>}
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">Code de test (facultatif)</label>
            <input name="testEventCode" defaultValue={view.testEventCode} className={`${input} ${err("testEventCode") ? "border-red-400" : ""}`} autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other" spellCheck={false} />
            <p className={`text-xs mt-1 ${err("testEventCode") ? "text-red-600" : "text-gray-500"}`}>{err("testEventCode") || info.testHelp}</p>
          </div>

          <Message state={saveState} />
          <div className="flex justify-end">
            <Btn>Enregistrer</Btn>
          </div>
        </form>

        <form action={test} className="flex items-center justify-between gap-3 border-t pt-4">
          <input type="hidden" name="provider" value={view.provider} />
          <p className="text-xs text-gray-500">
            {view.provider === "meta"
              ? "Avec un code de test enregistré : envoie UN événement de test (non compté). Sans code : lecture du pixel, souvent non concluante avec un jeton API Conversions."
              : "Envoie un événement de test (visible uniquement dans l'outil de test TikTok)."}
          </p>
          <Btn kind="ghost">Tester la connexion</Btn>
        </form>
        <Message state={testState} />

        {view.history.length > 0 && (
          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer font-semibold">Historique des modifications</summary>
            <ul className="mt-2 space-y-1">
              {view.history.map((h, i) => (
                <li key={i}>
                  {fmtDate(h.created_at)} — {h.actor_label} : {h.summary}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  )
}
