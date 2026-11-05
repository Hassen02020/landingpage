import Link from "next/link"
import { notFound } from "next/navigation"
import { PRODUCTS, WHATSAPP_NUMBER } from "@/lib/config"
import { SOURCE_LABELS, STATUSES, STATUS_LABELS, findDuplicates, getActivities, getLead, listStaff, type Source } from "@/lib/server/crm"
import { addNoteAction, assignAction, changeStatusAction, followUpAction, markDuplicateAction, qualifyAction, whatsappLogAction, withdrawMarketingAction } from "../../../actions"
import { CONTACT_CHANNEL_LABELS, CONTACT_CHANNELS, REGIONS } from "@/lib/regions"
import { listTemplates, renderTemplate } from "@/lib/server/templates"
import { STATUS_COLORS, formatDate } from "../../../format"
import { blockLeadPhoneAction } from "../../../settings-actions"
import { currentStaff } from "@/lib/server/auth"

export const dynamic = "force-dynamic"

const ACTIVITY_LABELS: Record<string, string> = {
  created: "Création", status_change: "Statut", note: "Note", assignment: "Assignation",
  follow_up: "Relance", marketing_withdrawn: "Consentement", anonymized: "Anonymisation",
  wa_in: "💬 WhatsApp reçu", wa_out: "💬 WhatsApp envoyé",
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium break-all">{value ?? "—"}</span>
    </div>
  )
}

export default async function LeadPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; erreur?: string } }) {
  const lead = await getLead(params.id)
  if (!lead) notFound()
  const [activities, staff, me, templates, duplicates] = await Promise.all([
    getActivities(lead.id),
    listStaff().catch(() => []),
    currentStaff(),
    listTemplates({ activeOnly: true, product: lead.product }).catch(() => []),
    findDuplicates(lead).catch(() => []),
  ])
  const locked = Boolean(lead.anonymized_at)
  const wa = lead.phone ? `https://wa.me/${lead.phone}?text=${encodeURIComponent(`Bonjour ${lead.first_name}, Easy2Book au sujet de votre demande ${lead.ref}.`)}` : null

  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm underline">← Leads</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black">{lead.first_name} {lead.last_name ?? ""}</h1>
        <span className="font-mono text-gray-500">{lead.ref}</span>
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[lead.status]}`}>{STATUS_LABELS[lead.status]}</span>
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="ml-auto bg-green-500 text-white font-bold px-4 py-2 rounded-xl">💬 WhatsApp</a>}
      </div>
      {searchParams.ok && <div className="p-3 rounded-xl bg-green-50 text-green-800 text-sm">{searchParams.ok}</div>}
      {searchParams.erreur && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{searchParams.erreur}</div>}
      {locked && <div className="p-3 rounded-xl bg-gray-100 text-gray-700 text-sm">Lead anonymisé le {formatDate(lead.anonymized_at)} : lecture seule.</div>}

      {lead.phone && !locked && templates.length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm p-4 text-sm">
          <h2 className="font-bold mb-2">Messages WhatsApp prêts</h2>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <a
                key={t.id}
                href={`https://wa.me/${lead.phone}?text=${encodeURIComponent(renderTemplate(t.body, lead))}`}
                target="_blank"
                rel="noopener noreferrer"
                title={renderTemplate(t.body, lead)}
                className="border border-green-300 text-green-800 bg-green-50 hover:bg-green-100 rounded-xl px-3 py-1.5 font-semibold"
              >
                💬 {t.title}
              </a>
            ))}
          </div>
        </section>
      )}

      {lead.phone && !locked && (
        <section className="bg-white rounded-2xl shadow-sm p-4 text-sm">
          <h2 className="font-bold">Échanges WhatsApp</h2>
          <p className="text-gray-500 mb-2">Aucune API WhatsApp n&apos;est connectée : enregistrez ici les messages reçus ou envoyés pour suivre la conversation (comptée dans les statistiques WhatsApp).</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {([["in", "💬 Message reçu"], ["out", "💬 Message envoyé"]] as const).map(([dir, label]) => (
              <form key={dir} action={whatsappLogAction} className="flex gap-2">
                <input type="hidden" name="id" value={lead.id} />
                <input type="hidden" name="direction" value={dir} />
                <input name="text" maxLength={500} placeholder="Résumé (facultatif)" className="flex-1 min-w-0 px-3 py-2 rounded-lg border" />
                <button className="shrink-0 border border-green-300 text-green-800 bg-green-50 hover:bg-green-100 rounded-lg px-3 py-2 font-semibold">{label}</button>
              </form>
            ))}
          </div>
        </section>
      )}

      {duplicates.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">
          <h2 className="font-bold mb-2">⚠️ Même numéro : {duplicates.length} autre(s) demande(s)</h2>
          <ul className="space-y-1">
            {duplicates.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/leads/${d.id}`} className="font-mono underline">{d.ref}</Link>
                <span>{PRODUCTS[d.product]}{d.offer ? ` — ${d.offer}` : ""}</span>
                <span className="text-gray-600">{STATUS_LABELS[d.status]} · {formatDate(d.created_at)}</span>
                {!locked && lead.status !== "perdu" && (
                  <form action={markDuplicateAction}>
                    <input type="hidden" name="id" value={lead.id} />
                    <input type="hidden" name="of" value={d.ref} />
                    <button className="text-xs underline text-amber-800">Marquer cette fiche comme doublon de {d.ref}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl shadow-sm p-4 text-sm">
          <h2 className="font-bold mb-2">Demande</h2>
          <Row label="Téléphone" value={lead.phone ? `+${lead.phone}` : null} />
          <Row label="Produit" value={PRODUCTS[lead.product]} />
          <Row label="Offre" value={lead.offer} />
          <Row label="Niche" value={lead.niche} />
          <Row label="Destination" value={lead.destination} />
          <Row label="Date / période" value={lead.travel_date || lead.travel_period} />
          <Row label="Voyageurs" value={lead.adults === null || lead.adults === undefined ? null : `${lead.adults} adulte(s), ${lead.children ?? 0} enfant(s)`} />
          <Row label="Région" value={lead.region} />
          <Row label="E-mail" value={lead.email} />
          <Row label="Canal préféré" value={lead.contact_channel ? CONTACT_CHANNEL_LABELS[lead.contact_channel] : null} />
          <Row label="Budget déclaré" value={lead.budget} />
          <Row label="Message" value={lead.message} />
          <Row label="Code promo" value={lead.promo_code ?? null} />
          <Row label="Source" value={lead.source ? SOURCE_LABELS[lead.source as Source] : null} />
          <Row label="Reçu le" value={formatDate(lead.created_at)} />
          <Row label="Montant réservé" value={lead.booking_value !== null ? `${lead.booking_value} TND` : null} />
          {me?.role === "admin" && lead.phone && !locked && (
            <form action={blockLeadPhoneAction} className="mt-3">
              <input type="hidden" name="phone" value={lead.phone} />
              <input type="hidden" name="ref" value={lead.ref} />
              <input type="hidden" name="leadId" value={lead.id} />
              <button className="text-xs underline text-red-700">🚫 Bloquer ce numéro (faux lead / spam)</button>
            </form>
          )}
        </section>
        <section className="bg-white rounded-2xl shadow-sm p-4 text-sm">
          <h2 className="font-bold mb-2">Attribution et consentements</h2>
          <Row label="Canal" value={lead.channel} />
          <Row label="Campagne" value={lead.utm_campaign} />
          <Row label="Groupe d'annonces" value={lead.utm_term || lead.adset_id} />
          <Row label="Annonce" value={lead.utm_content || lead.ad_id} />
          <Row label="Source" value={[lead.utm_source, lead.utm_medium].filter(Boolean).join(" · ") || null} />
          <Row label="Page d'arrivée" value={lead.landing_page} />
          <Row label="Page du formulaire" value={lead.form_page} />
          <Row label="Code visiteur" value={lead.visitor_ref} />
          <Row label="Traceurs acceptés" value={lead.tracking_consent ? "Oui" : "Non"} />
          <Row label="Marketing" value={lead.marketing_withdrawn_at ? `Retiré le ${formatDate(lead.marketing_withdrawn_at)}` : lead.marketing_consent ? "Accepté" : "Non"} />
          {!locked && lead.marketing_consent && (
            <form action={withdrawMarketingAction} className="mt-2">
              <input type="hidden" name="id" value={lead.id} />
              <button className="text-xs underline text-red-700">Enregistrer un retrait du consentement marketing</button>
            </form>
          )}
        </section>
      </div>

      {!locked && (
        <form action={qualifyAction} className="bg-white rounded-2xl shadow-sm p-4 text-sm space-y-3">
          <input type="hidden" name="id" value={lead.id} />
          <div>
            <h2 className="font-bold">Qualification</h2>
            <p className="text-gray-500">À compléter pendant l&apos;échange avec le prospect. Le budget est une déclaration, pas une dépense réelle.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block"><span className="font-semibold">Région</span>
              <select name="region" defaultValue={lead.region ?? ""} className="mt-1 w-full px-3 py-2 rounded-lg border">
                <option value="">Non renseignée</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="block"><span className="font-semibold">E-mail</span>
              <input name="email" type="email" defaultValue={lead.email ?? ""} placeholder="facultatif" className="mt-1 w-full px-3 py-2 rounded-lg border" dir="ltr" />
            </label>
            <label className="block"><span className="font-semibold">Budget déclaré</span>
              <input name="budget" defaultValue={lead.budget ?? ""} placeholder="ex. 5 000 TND / pers." maxLength={64} className="mt-1 w-full px-3 py-2 rounded-lg border" />
            </label>
            <label className="block"><span className="font-semibold">Canal préféré</span>
              <select name="contact_channel" defaultValue={lead.contact_channel ?? "whatsapp"} className="mt-1 w-full px-3 py-2 rounded-lg border">
                {CONTACT_CHANNELS.map((c) => <option key={c} value={c}>{CONTACT_CHANNEL_LABELS[c]}</option>)}
              </select>
            </label>
            <label className="block"><span className="font-semibold">Adultes</span>
              <input name="adults" inputMode="numeric" defaultValue={lead.adults ?? ""} placeholder="non précisé" className="mt-1 w-full px-3 py-2 rounded-lg border" />
            </label>
            <label className="block"><span className="font-semibold">Enfants</span>
              <input name="children" inputMode="numeric" defaultValue={lead.children ?? ""} placeholder="non précisé" className="mt-1 w-full px-3 py-2 rounded-lg border" />
            </label>
            <label className="block sm:col-span-2"><span className="font-semibold">Période souhaitée</span>
              <input name="travel_period" defaultValue={lead.travel_period ?? ""} placeholder="ex. février 2027" maxLength={64} className="mt-1 w-full px-3 py-2 rounded-lg border" />
            </label>
          </div>
          <div className="flex justify-end"><button className="bg-violet-700 hover:bg-violet-800 text-white font-bold px-5 py-2 rounded-lg">Enregistrer la qualification</button></div>
        </form>
      )}

      {!locked && (
        <div className="grid md:grid-cols-3 gap-4">
          <form action={changeStatusAction} className="bg-white rounded-2xl shadow-sm p-4 space-y-2 text-sm">
            <h2 className="font-bold">Changer le statut</h2>
            <input type="hidden" name="id" value={lead.id} />
            <select name="status" defaultValue={lead.status} className="w-full px-3 py-2 rounded-lg border">
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <input name="booking_value" inputMode="decimal" placeholder="Montant TND (obligatoire si réservé)" defaultValue={lead.booking_value ?? ""} className="w-full px-3 py-2 rounded-lg border" />
            <input name="notes" placeholder="Commentaire (facultatif)" className="w-full px-3 py-2 rounded-lg border" />
            <button className="w-full bg-violet-700 text-white font-bold py-2 rounded-lg">Enregistrer</button>
          </form>
          <form action={followUpAction} className="bg-white rounded-2xl shadow-sm p-4 space-y-2 text-sm">
            <h2 className="font-bold">Relance</h2>
            <input type="hidden" name="id" value={lead.id} />
            <p className="text-gray-500">Actuelle : {formatDate(lead.next_follow_up_at)}</p>
            <input type="datetime-local" name="follow_up" className="w-full px-3 py-2 rounded-lg border" />
            <button className="w-full bg-violet-700 text-white font-bold py-2 rounded-lg">Planifier (vide = supprimer)</button>
          </form>
          <form action={assignAction} className="bg-white rounded-2xl shadow-sm p-4 space-y-2 text-sm">
            <h2 className="font-bold">Responsable</h2>
            <input type="hidden" name="id" value={lead.id} />
            <select name="assigned_to" defaultValue={lead.assigned_to ?? ""} className="w-full px-3 py-2 rounded-lg border">
              <option value="">Non assigné</option>
              {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name || s.email}</option>)}
            </select>
            <button className="w-full bg-violet-700 text-white font-bold py-2 rounded-lg">Assigner</button>
          </form>
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-sm p-4 text-sm space-y-3">
        <h2 className="font-bold">Historique</h2>
        {!locked && (
          <form action={addNoteAction} className="flex gap-2">
            <input type="hidden" name="id" value={lead.id} />
            <input name="body" required maxLength={2000} placeholder="Ajouter une note (appel, échange WhatsApp…)" className="flex-1 px-3 py-2 rounded-lg border" />
            <button className="px-4 py-2 rounded-lg bg-gray-900 text-white font-bold">Ajouter</button>
          </form>
        )}
        <ul className="divide-y">
          {activities.length === 0 && <li className="py-2 text-gray-500">Aucune activité.</li>}
          {activities.map((a) => (
            <li key={a.id} className="py-2">
              <span className="text-gray-500">{formatDate(a.created_at)} · {a.actor_label} · </span>
              <strong>{ACTIVITY_LABELS[a.type] ?? a.type}</strong>
              {a.from_status && a.to_status && <span> : {STATUS_LABELS[a.from_status]} → {STATUS_LABELS[a.to_status]}</span>}
              {a.body && <div className="whitespace-pre-wrap">{a.body}</div>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
