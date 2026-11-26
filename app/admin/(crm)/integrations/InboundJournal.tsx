import { INBOUND_STATUS_LABEL, type ChannelHealth, type InboundEventRow } from "@/lib/server/inbound-events"

const PLATFORM_LABEL: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", whatsapp: "WhatsApp" }
const STATUS_STYLE: Record<string, string> = {
  created: "bg-green-100 text-green-800",
  duplicate: "bg-gray-200 text-gray-700",
  ignored: "bg-amber-100 text-amber-800",
  dropped: "bg-red-100 text-red-800",
  retry: "bg-blue-100 text-blue-800",
}
const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Africa/Tunis", dateStyle: "short", timeStyle: "short" })

/** Suivi des leads reçus automatiquement : santé par canal (7 jours) et derniers événements. Aucune donnée personnelle. */
export function InboundJournal({ events, health, tableMissing }: { events: InboundEventRow[]; health: ChannelHealth[]; tableMissing: boolean }) {
  const lost = health.reduce((n, h) => n + h.dropped, 0)
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4 lg:col-span-2">
      <div>
        <h2 className="font-black">Leads reçus automatiquement — suivi</h2>
        <p className="text-xs text-gray-600">Chaque événement reçu de Facebook, Instagram, TikTok ou WhatsApp et son issue. Aucun nom, téléphone ni message n&apos;est conservé ici.</p>
      </div>
      {tableMissing ? (
        <p className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-sm">La migration 0023 n&apos;est pas encore appliquée dans Supabase : le suivi est indisponible (les leads reçus sont enregistrés normalement).</p>
      ) : (
        <>
          {lost > 0 && (
            <p className="bg-red-50 border border-red-200 text-red-900 rounded-xl p-3 text-sm">
              {lost} événement(s) abandonné(s) sur 7 jours : un lead n&apos;a pas pu être enregistré (jeton de Page expiré, lead supprimé, données invalides). Vérifiez la carte du canal concerné.
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {health.map((h) => (
              <div key={h.platform} className="border rounded-xl p-3 text-sm">
                <div className="font-bold">{PLATFORM_LABEL[h.platform]}</div>
                <div className="text-xs text-gray-500">{h.lastAt ? `Dernier événement : ${fmt(h.lastAt)}` : "Aucun événement reçu"}</div>
                <div className="text-xs mt-1 text-gray-700">
                  {h.created} créé(s) · {h.duplicate} doublon(s) · {h.ignored} ignoré(s) · {h.dropped} abandonné(s) · {h.retry} à rejouer
                </div>
              </div>
            ))}
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun événement reçu pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th scope="col" className="py-2 pe-3">Date (Tunis)</th>
                    <th scope="col" className="pe-3">Canal</th>
                    <th scope="col" className="pe-3">Source</th>
                    <th scope="col" className="pe-3">Issue</th>
                    <th>Raison</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 pe-3 whitespace-nowrap">{fmt(e.created_at)}</td>
                      <td className="pe-3">{PLATFORM_LABEL[e.platform] ?? e.platform}</td>
                      <td className="pe-3 text-gray-500" dir="ltr">{e.source_ref ?? "—"}</td>
                      <td className="pe-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[e.status] ?? ""}`}>{INBOUND_STATUS_LABEL[e.status] ?? e.status}</span>
                      </td>
                      <td className="text-gray-600">{e.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
