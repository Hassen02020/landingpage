"use client"

import { useState } from "react"
import { CONSENT_TEXT_VERSION } from "@/lib/config"
import { STANDARD_LABELS, type FormConfig } from "@/lib/form-config"

export function OrgLeadForm({ slug, config, offers }: { slug: string; config: FormConfig; offers: string[] }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const f = config.fields
  const input = "w-full rounded-xl border border-gray-300 px-4 py-3"

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const custom: Record<string, string> = {}
    for (const c of config.custom) custom[c.key] = String(fd.get(`custom_${c.key}`) ?? "")
    setBusy(true)
    setError(null)
    setErrors({})
    try {
      const res = await fetch(`/api/o/${slug}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"), phone: fd.get("phone"), email: fd.get("email"), message: fd.get("message"), offer: fd.get("offer"), budget: fd.get("budget"),
          custom, website: fd.get("website"), contactConsent: fd.get("consent") === "on", marketingConsent: false, trackingConsent: false,
          attribution: { page_url: window.location.href, landing_page: window.location.pathname },
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { ref?: string; error?: string; errors?: Record<string, string> }
      if (res.ok) setDone(json.ref ?? "")
      else {
        setErrors(json.errors ?? {})
        setError(json.error ?? "Envoi impossible pour le moment.")
      }
    } catch {
      setError("Envoi impossible pour le moment. Réessayez dans un instant.")
    } finally {
      setBusy(false)
    }
  }

  if (done !== null) {
    return (
      <div className="text-center" role="status">
        <p className="text-xl font-black">Merci !</p>
        <p className="mt-2 text-gray-700">{config.thanks || "Votre demande a bien été reçue. Nous vous recontactons très vite."}</p>
        {done && <p className="mt-3 text-xs text-gray-500">Référence : <span dir="ltr" className="font-mono">{done}</span></p>}
      </div>
    )
  }

  const Err = ({ k }: { k: string }) => (errors[k] ? <p className="mt-1 text-sm text-red-700">{errors[k]}</p> : null)
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div><input name="name" required placeholder="Nom et prénom" className={input} autoComplete="name" /><Err k="name" /></div>
      <div><input name="phone" type="tel" required placeholder="Téléphone" className={input} autoComplete="tel" dir="ltr" /><Err k="phone" /></div>
      {f.email.enabled && <div><input name="email" type="email" placeholder={`${STANDARD_LABELS.email}${f.email.required ? " *" : ""}`} className={input} autoComplete="email" dir="ltr" /><Err k="email" /></div>}
      {f.offer.enabled && (
        <div>
          {offers.length ? (
            <select name="offer" className={input} defaultValue=""><option value="">{STANDARD_LABELS.offer}{f.offer.required ? " *" : ""}</option>{offers.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          ) : (
            <input name="offer" placeholder={`${STANDARD_LABELS.offer}${f.offer.required ? " *" : ""}`} className={input} />
          )}
          <Err k="offer" />
        </div>
      )}
      {f.budget.enabled && <div><input name="budget" placeholder={`${STANDARD_LABELS.budget}${f.budget.required ? " *" : ""}`} className={input} /><Err k="budget" /></div>}
      {config.custom.map((c) => (
        <div key={c.key}><input name={`custom_${c.key}`} placeholder={`${c.label}${c.required ? " *" : ""}`} className={input} /><Err k={c.key} /></div>
      ))}
      {f.message.enabled && <div><textarea name="message" rows={3} placeholder={`${STANDARD_LABELS.message}${f.message.required ? " *" : ""}`} className={input} /><Err k="message" /></div>}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input name="consent" type="checkbox" className="mt-1" />
        <span>J&apos;accepte d&apos;être recontacté au sujet de ma demande (v{CONSENT_TEXT_VERSION}).</span>
      </label>
      <Err k="contactConsent" />
      <button disabled={busy} className="w-full rounded-xl bg-violet-700 py-3 font-bold text-white hover:bg-violet-800 disabled:opacity-50">{busy ? "Envoi…" : "Envoyer ma demande"}</button>
    </form>
  )
}
