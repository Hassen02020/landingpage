import { can, canDecideDuplicate, canFlagDuplicate, canReopenDuplicate } from "@/lib/permissions"
import { candidatesFor, reviewsForLead } from "@/lib/server/duplicates"
import { DUP_RULE_LABELS, DUP_STATUS_LABELS } from "@/lib/duplicates"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PRODUCTS, WHATSAPP_NUMBER } from "@/lib/config"
import { SOURCE_LABELS, STATUSES, STATUS_LABELS, findDuplicates, getActivities, getLead, listStaff, type Source } from "@/lib/server/crm"
import ConversationFields from "./ConversationFields"
import { addNoteAction, callLogAction, assignAction, changeStatusAction, decideDuplicateAction, flagDuplicateAction, followUpAction, markTestAction, reopenDuplicateAction, qualifyAction, whatsappLogAction, withdrawMarketingAction } from "../../../actions"
import { CONTACT_CHANNEL_LABELS, CONTACT_CHANNELS, REGIONS } from "@/lib/regions"
import { listTemplates, renderTemplate } from "@/lib/server/templates"
import { formatDate } from "../../../format"
import { blockLeadPhoneAction } from "../../../settings-actions"
import { currentStaff } from "@/lib/server/auth"
import { waText } from "@/lib/wa-text"
import { loadFormConfig } from "@/lib/server/org-public"
import { LOSS_REASONS, LOSS_REASON_LABELS } from "@/lib/governance"
import { Notice, StatusBadge } from "../../_components/ui"

export const dynamic = "force-dynamic"

const ACTIVITY_LABELS: Record<string, string> = {
  created: "Création", status_change: "Statut", note: "Note", assignment: "Assignation",
  follow_up: "Relance", marketing_withdrawn: "Consentement", anonymized: "Anonymisation",
  wa_in: "💬 WhatsApp reçu", wa_out: "💬 WhatsApp envoyé",
  duplicate_flagged: "Doublon signalé", duplicate_confirmed: "Doublon confirmé", duplicate_rejected: "Doublon rejeté", duplicate_reopened: "Doublon rouvert",
}

const locked_ = (l: { anonymized_at?: string | null }) => Boolean(l.anonymized_at)

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b last:border-0">
      <span className="text-gray-600">{label}</span>
      <span className="text-right font-medium break-all">{value ?? "—"}</span>
    </div>
  )
}

export default async function LeadPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; erreur?: string } }) {
  const lead = await getLead(params.id)
  const formConfig = await loadFormConfig()
  if (!lead) notFound()
  const [activities, staff, me, templates, duplicates, candidates, dupReviews] = await Promise.all([
    getActivities(lead.id),
    listStaff().catch(() => []),
    currentStaff(),
    listTemplates({ activeOnly: true, product: lead.product }).catch(() => []),
    findDuplicates(lead).catch(() => []),
    candidatesFor(lead).catch(() => []),
    reviewsForLead(lead.id).catch(() => []),
  ])
  const refOfId = new Map<string, string>([[lead.id, lead.ref], ...duplicates.map((d): [string, string] => [d.id, d.ref])])
  const reviewedOthers = new Set(dupReviews.filter((r) => r.status !== "rejete").map((r) => (r.lead_id === lead.id ? r.primary_lead_id : r.lead_id)))
  const mayFlag = Boolean(me) && !locked_(lead) && canFlagDuplicate(me?.orgRole, me?.userId ?? "", lead)
  const locked = Boolean(lead.anonymized_at)
  const wa = lead.phone ? `https://wa.me/${lead.phone}?text=${encodeURIComponent(`Bonjour ${lead.first_name}, Easy2Book au sujet de votre demande ${lead.ref}.`)}` : null

  return (
    <div className="space-y-4">
      <Link href="/admin" className="inline-flex min-h-[36px] items-center text-sm font-semibold text-brand-700 underline">← Leads</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black [overflow-wrap:anywhere] min-w-0">{lead.first_name} {lead.last_name ?? ""}</h1>
        <span className="font-mono text-gray-600">{lead.ref}</span>
        {lead.phone && !locked && <Link href={`/admin/clients/${lead.phone}`} className="text-sm underline">Voir le client (360°)</Link>}
        <StatusBadge status={lead.status} />
        {lead.is_test && <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-800 text-white" data-testid="test-badge">TEST : exclu des analyses</span>}
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex min-h-[44px] items-center bg-e2b-wa hover:bg-e2b-wa-dark text-white font-bold px-4 py-2 rounded-xl">💬 WhatsApp</a>}
      </div>
      {searchParams.ok && <Notice tone="success">{searchParams.ok}</Notice>}
      {searchParams.erreur && <Notice tone="error">{searchParams.erreur}</Notice>}
      {!locked && can(me?.orgRole, "reports.view") && (
        <form action={markTestAction} className="flex flex-wrap items-center gap-3 text-sm" data-testid="test-form">
          <input type="hidden" name="id" value={lead.id} />
          <input type="hidden" name="is_test" value={lead.is_test ? "0" : "1"} />
          <button className="border rounded-lg px-3 py-1.5 font-semibold hover:bg-gray-50">{lead.is_test ? "Retirer la marque test" : "Marquer comme test"}</button>
          <span className="text-gray-600">{lead.is_test ? "Ce lead est exclu des statistiques, de la rentabilité, des clients et de l'export." : "Pour un essai ou une démonstration : le lead reste visible ici mais n'entre plus dans les analyses."}</span>
        </form>
      )}
      {locked && <div className="p-3 rounded-xl bg-gray-100 text-gray-700 text-sm">Lead anonymisé le {formatDate(lead.anonymized_at)} : lecture seule.</div>}

      {/* actions principales en tête de fiche (LOT 3) : statut, relance, responsable — mêmes formulaires, mêmes règles */}
      {!locked && (
        <div className="grid gap-4 md:grid-cols-3" data-testid="lead-actions">
          <form action={changeStatusAction} className="bg-white rounded-2xl shadow-sm p-4 space-y-2 text-sm">
            <h2 className="font-bold">Changer le statut</h2>
            <input type="hidden" name="id" value={lead.id} />
            <select name="status" aria-label="Nouveau statut" defaultValue={lead.status} className="w-full px-3 py-2 rounded-lg border">
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <input name="booking_value" aria-label="Montant en TND" inputMode="decimal" placeholder="Montant TND (obligatoire si réservé ou gagné)" defaultValue={lead.booking_value ?? ""} className="w-full px-3 py-2 rounded-lg border" />
            <label className="block text-xs text-gray-600">Produit acheté (si réservé ou gagné)
              <select name="purchased_product" defaultValue={lead.purchased_product ?? lead.product} className="mt-1 w-full px-3 py-2 rounded-lg border text-sm text-gray-900" data-testid="purchased-product">
                {Object.entries(PRODUCTS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
            <label className="block text-xs text-gray-600">Motif de perte (obligatoire si perdu)
              <select name="lost_reason" defaultValue={lead.lost_reason ?? ""} className="mt-1 w-full px-3 py-2 rounded-lg border text-sm text-gray-900" data-testid="lost-reason">
                <option value="">Choisir un motif…</option>
                {LOSS_REASONS.map((r) => <option key={r} value={r}>{LOSS_REASON_LABELS[r]}</option>)}
              </select>
            </label>
            <input name="notes" aria-label="Commentaire" placeholder="Commentaire (facultatif)" className="w-full px-3 py-2 rounded-lg border" />
            <input name="distinct_reason" aria-label="Motif de distinction" maxLength={300} placeholder="Réservation distincte d'un autre dossier du client : motif (seulement si demandé)" className="w-full px-3 py-2 rounded-lg border" data-testid="distinct-reason" />
            <button className="w-full bg-brand-700 text-white font-bold py-2 rounded-lg">Enregistrer</button>
          </form>
          <form action={followUpAction} className="bg-white rounded-2xl shadow-sm p-4 space-y-2 text-sm">
            <h2 className="font-bold">Relance</h2>
            <input type="hidden" name="id" value={lead.id} />
            <p className="text-gray-600">Actuelle : {formatDate(lead.next_follow_up_at)}</p>
            <input type="datetime-local" name="follow_up" aria-label="Date de relance" className="w-full px-3 py-2 rounded-lg border" />
            <button className="w-full bg-brand-700 text-white font-bold py-2 rounded-lg">Planifier (vide = supprimer)</button>
          </form>
          <form action={assignAction} className="bg-white rounded-2xl shadow-sm p-4 space-y-2 text-sm">
            <h2 className="font-bold">Responsable</h2>
            <input type="hidden" name="id" value={lead.id} />
            <select name="assigned_to" aria-label="Responsable" defaultValue={lead.assigned_to ?? ""} className="w-full px-3 py-2 rounded-lg border">
              <option value="">Non assigné</option>
              {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name || s.email}</option>)}
            </select>
            <button className="w-full bg-brand-700 text-white font-bold py-2 rounded-lg">Assigner</button>
          </form>
        </div>
      )}


      {lead.phone && !locked && templates.length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm p-4 text-sm">
          <h2 className="font-bold mb-2">Messages WhatsApp prêts</h2>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <a
                key={t.id}
                href={`https://wa.me/${lead.phone}?text=${encodeURIComponent(waText(renderTemplate(t.body, lead)))}`}
                target="_blank"
                rel="noopener noreferrer"
                title={waText(renderTemplate(t.body, lead))}
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
          <p className="text-gray-600 mb-2">Aucune API WhatsApp n&apos;est connectée : enregistrez ici le <strong>thème</strong> des messages reçus ou envoyés pour suivre la conversation (comptée dans les statistiques WhatsApp). Le texte du message n&apos;est pas conservé.</p>
          <div className="grid gap-3">
            {([["in", "💬 Message reçu"], ["out", "💬 Message envoyé"]] as const).map(([dir, label]) => (
              <form key={dir} action={whatsappLogAction} className="flex gap-2 items-start">
                <input type="hidden" name="id" value={lead.id} />
                <input type="hidden" name="direction" value={dir} />
                <ConversationFields idPrefix={`wa-${dir}`} />
                <button className="shrink-0 bg-e2b-wa hover:bg-e2b-wa-dark text-white rounded-lg px-3 py-2 font-semibold">{label}</button>
              </form>
            ))}
          </div>
          <h2 className="font-bold mt-4">Appel téléphonique</h2>
          <form action={callLogAction} className="flex gap-2 items-start mt-2">
            <input type="hidden" name="id" value={lead.id} />
            <ConversationFields idPrefix="call" />
            <button className="shrink-0 bg-gray-900 text-white rounded-lg px-3 py-2 font-semibold">📞 Appel enregistré</button>
          </form>
        </section>
      )}

      {lead.duplicate_of && (
        <section className="bg-gray-100 border border-gray-300 rounded-2xl p-4 text-sm" data-testid="duplicate-confirmed">
          <h2 className="font-bold">Doublon confirmé de <Link href={`/admin/leads/${lead.duplicate_of}`} className="underline font-mono">{refOfId.get(lead.duplicate_of) ?? "dossier principal"}</Link></h2>
          <p className="text-gray-700">Ce dossier n&apos;est plus compté dans les ventes, le chiffre d&apos;affaires, la conversion ni les envois publicitaires. Il reste consultable ; son statut et ses notes sont conservés.</p>
        </section>
      )}

      {duplicates.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm" data-testid="duplicates">
          <h2 className="font-bold mb-2">⚠️ Même numéro : {duplicates.length} autre(s) demande(s)</h2>
          <p className="text-xs text-gray-600 mb-2">Un rapprochement est un signalement à examiner, jamais une preuve : une demande à plusieurs jours d&apos;écart est un intérêt renouvelé. Rien n&apos;est fusionné ni supprimé.</p>
          <ul className="space-y-1">
            {duplicates.map((d) => {
              const cand = candidates.find((c) => c.otherId === d.id)
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/leads/${d.id}`} className="font-mono underline">{d.ref}</Link>
                  <span>{PRODUCTS[d.product]}{d.offer ? ` — ${d.offer}` : ""}</span>
                  <span className="text-gray-600">{STATUS_LABELS[d.status]} · {formatDate(d.created_at)}</span>
                  {cand && <span className="text-xs rounded-full bg-amber-200 px-2 py-0.5" data-testid="dup-candidate">{DUP_RULE_LABELS[cand.rule]} · confiance {cand.confidence === "elevee" ? "élevée" : "faible"}</span>}
                  {mayFlag && !reviewedOthers.has(d.id) && !lead.duplicate_of && (
                    <form action={flagDuplicateAction} className="flex flex-wrap items-center gap-1">
                      <input type="hidden" name="id" value={lead.id} />
                      <input type="hidden" name="of" value={d.ref} />
                      <input name="reason" maxLength={200} placeholder="Motif (facultatif)" className="px-2 py-1 rounded border text-xs" />
                      <button className="text-xs underline text-amber-800">Signaler comme doublon potentiel de {d.ref}</button>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {dupReviews.length > 0 && (
        <section className="bg-white border rounded-2xl p-4 text-sm space-y-2" data-testid="dup-reviews">
          <h2 className="font-bold">Signalements de doublon</h2>
          {dupReviews.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 border-b last:border-0 pb-2 last:pb-0" data-testid="dup-review" data-status={r.status}>
              <span className="font-mono">{refOfId.get(r.lead_id) ?? "?"} → {refOfId.get(r.primary_lead_id) ?? "?"}</span>
              <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5">{DUP_STATUS_LABELS[r.status]}</span>
              <span className="text-xs text-gray-600">{DUP_RULE_LABELS[r.rule]} · confiance {r.confidence === "elevee" ? "élevée" : "faible"} · {formatDate(r.reported_at)}</span>
              {r.status === "signale" && canDecideDuplicate(me?.orgRole, me?.userId ?? "", r) && (
                <form action={decideDuplicateAction} className="flex flex-wrap items-center gap-1">
                  <input type="hidden" name="review_id" value={r.id} /><input type="hidden" name="back" value={`/admin/leads/${lead.id}`} />
                  <input name="note" maxLength={300} placeholder="Note de décision (facultatif)" className="px-2 py-1 rounded border text-xs" />
                  <button name="decision" value="confirme" className="text-xs rounded bg-gray-800 text-white px-2 py-1">Confirmer</button>
                  <button name="decision" value="rejete" className="text-xs rounded border px-2 py-1">Rejeter</button>
                </form>
              )}
              {r.status === "signale" && me && !canDecideDuplicate(me.orgRole, me.userId, r) && <span className="text-xs text-gray-600">{r.reported_by === me.userId ? "En attente d'un autre responsable (double regard)." : "En attente d'un responsable."}</span>}
              {r.status !== "signale" && canReopenDuplicate(me?.orgRole) && (
                <form action={reopenDuplicateAction} className="flex items-center gap-1">
                  <input type="hidden" name="review_id" value={r.id} /><input type="hidden" name="back" value={`/admin/leads/${lead.id}`} />
                  <button className="text-xs underline">Rouvrir (administrateur)</button>
                </form>
              )}
            </div>
          ))}
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
          <Row label="Tranche d'âge (déclarée)" value={lead.age_range} />
          <Row label="E-mail" value={lead.email} />
          <Row label="Canal préféré" value={lead.contact_channel ? CONTACT_CHANNEL_LABELS[lead.contact_channel] : null} />
          <Row label="Budget déclaré" value={lead.budget} />
          <Row label="Message" value={lead.message} />
          {Object.entries(lead.custom_fields ?? {}).map(([k, v]) => (
            <Row key={k} label={formConfig.custom.find((c) => c.key === k)?.label ?? k} value={String(v)} />
          ))}
          <Row label="Code promo" value={lead.promo_code ?? null} />
          <Row label="Source" value={lead.source ? SOURCE_LABELS[lead.source as Source] : null} />
          <Row label="Reçu le" value={formatDate(lead.created_at)} />
          <Row label="Montant réservé" value={lead.booking_value !== null ? `${lead.booking_value} TND` : null} />
          {can(me?.orgRole, "data.export") && lead.phone && !locked && (
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
            <p className="text-gray-600">À compléter pendant l&apos;échange avec le prospect. Le budget est une déclaration, pas une dépense réelle.</p>
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
          <div className="flex justify-end"><button className="bg-brand-700 hover:bg-brand-800 text-white font-bold px-5 py-2 rounded-lg">Enregistrer la qualification</button></div>
        </form>
      )}

      <section className="bg-white rounded-2xl shadow-sm p-4 text-sm space-y-3">
        <h2 className="font-bold">Historique</h2>
        {!locked && (
          <form action={addNoteAction} className="flex gap-2">
            <input type="hidden" name="id" value={lead.id} />
            <input name="body" required maxLength={140} aria-label="Note courte" placeholder="Ajouter une note courte (140 max, ni numéro, ni e-mail, ni lien)" className="flex-1 px-3 py-2 rounded-lg border" />
            <button className="px-4 py-2 rounded-lg bg-gray-900 text-white font-bold">Ajouter</button>
          </form>
        )}
        <ul className="divide-y">
          {activities.length === 0 && <li className="py-2 text-gray-600">Aucune activité.</li>}
          {activities.map((a) => (
            <li key={a.id} className="py-2">
              <span className="text-gray-600">{formatDate(a.created_at)} · {a.actor_label} · </span>
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
