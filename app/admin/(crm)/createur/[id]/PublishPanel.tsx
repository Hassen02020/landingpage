"use client"

import { useFormState, useFormStatus } from "react-dom"
import { publishAction, unpublishAction } from "@/app/admin/createur-actions"
import { CopyButton } from "../../liens/LinkBuilder"

function Btn({ children, tone }: { children: React.ReactNode; tone: "go" | "stop" }) {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className={`font-black px-6 py-3 rounded-xl disabled:opacity-50 ${tone === "go" ? "bg-green-700 hover:bg-green-800 text-white" : "border border-red-300 text-red-700 hover:bg-red-50"}`}>{pending ? "…" : children}</button>
}

export function PublishPanel({ id, theme, visible, ready, publicUrl }: { id: string; theme: string; visible: boolean; ready: boolean; publicUrl: string }) {
  const [pub, publish] = useFormState(publishAction, undefined)
  const [unpub, unpublishFn] = useFormState(unpublishAction, undefined)
  const msg = pub?.message || unpub?.message
  const ok = pub?.ok || unpub?.ok
  return (
    <section className="bg-white rounded-2xl border p-5 space-y-4" aria-label="Publication">
      <h2 className="font-black">Publication</h2>
      {visible ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm">
          <div className="font-bold text-green-800">Page publiée — adresse publique stable</div>
          <div className="mt-1 flex items-start gap-2"><code className="min-w-0 flex-1 break-all select-all" dir="ltr" data-testid="public-url">{publicUrl}</code><CopyButton text={publicUrl} label="Copier l'adresse" /></div>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-bold text-green-800 underline">Ouvrir la page publique ↗</a>
        </div>
      ) : (
        <p className="text-sm text-gray-600">La page est un <strong>brouillon</strong> : elle n&apos;est visible que dans l&apos;aperçu.</p>
      )}
      {msg && <div role="status" className={`rounded-xl p-3 text-sm ${ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>{msg}</div>}
      {visible ? (
        <form action={unpublishFn} className="flex items-center gap-3"><input type="hidden" name="id" value={id} /><input type="hidden" name="theme" value={theme} /><Btn tone="stop">Masquer la page</Btn><span className="text-xs text-gray-500">Les liens déjà diffusés ne mèneront plus à une page visible.</span></form>
      ) : (
        <form action={publish} className="flex items-center gap-3"><input type="hidden" name="id" value={id} /><input type="hidden" name="theme" value={theme} />{ready ? <Btn tone="go">Publier la page</Btn> : <button type="button" disabled className="bg-gray-200 text-gray-500 font-black px-6 py-3 rounded-xl cursor-not-allowed">Publier la page</button>}{!ready && <span className="text-sm text-red-700">Corrigez d&apos;abord les points signalés à l&apos;étape Aperçu.</span>}</form>
      )}
    </section>
  )
}
