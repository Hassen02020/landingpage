import { currentStaff } from "@/lib/server/auth"
import { COUNTRIES, protectionView } from "@/lib/server/protection"
import { unblockAction } from "../../settings-actions"
import { BlockForm, CountriesForm } from "./Forms"

export const dynamic = "force-dynamic"

const fmt = (iso: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Africa/Tunis" }).format(new Date(iso))

export default async function ProtectionPage() {
  const staff = await currentStaff()
  if (staff?.role !== "admin") return <p className="bg-white rounded-2xl p-6">Cette page est réservée aux administrateurs.</p>
  const v = await protectionView()
  const phones = v.blocks.filter((b) => b.kind === "phone")
  const ips = v.blocks.filter((b) => b.kind === "ip")
  const card = "bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4"

  const List = ({ rows }: { rows: typeof v.blocks }) =>
    rows.length === 0 ? (
      <p className="text-sm text-gray-500 border border-dashed rounded-xl p-6 text-center">Aucun élément bloqué pour le moment.</p>
    ) : (
      <ul className="divide-y text-sm">
        {rows.map((b) => (
          <li key={b.id} className="py-2 flex items-center justify-between gap-3">
            <div>
              <div className="font-mono" dir="ltr">{b.kind === "phone" ? `+${b.value}` : b.value}</div>
              <div className="text-xs text-gray-500">{b.reason || "—"} · {fmt(b.updated_at)}{b.actor_label ? ` · ${b.actor_label}` : ""}</div>
            </div>
            <form action={unblockAction}>
              <input type="hidden" name="id" value={b.id} />
              <button className="text-xs border rounded-lg px-2 py-1 hover:bg-gray-50">Débloquer</button>
            </form>
          </li>
        ))}
      </ul>
    )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Protection des formulaires</h1>
        <p className="text-sm text-gray-600">Refuser les faux leads et le spam avant qu&apos;ils n&apos;arrivent dans la liste.</p>
      </div>
      {!v.migrationApplied && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">
          La migration <code>0003_landing_admin.sql</code> n&apos;est pas encore appliquée : aucune règle n&apos;est active.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="bg-white rounded-2xl border p-4">Pays autorisés<strong className="block text-lg">{v.allowedCountries.length ? v.allowedCountries.join(", ") : "Tous"}</strong></div>
        <div className="bg-white rounded-2xl border p-4">Téléphones bloqués<strong className="block text-lg">{phones.length}</strong></div>
        <div className="bg-white rounded-2xl border p-4">IP bloquées<strong className="block text-lg">{ips.length}</strong></div>
        <div className="bg-white rounded-2xl border p-4">Déjà actif<strong className="block text-xs font-normal text-gray-600 mt-1">champ piège anti-robots, 5 envois / 10 min par IP, 1 lead / téléphone / produit / jour</strong></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className={card}>
          <h2 className="font-black">Téléphones bloqués</h2>
          <BlockForm kind="phone" />
          <List rows={phones} />
        </section>
        <section className={card}>
          <h2 className="font-black">IP bloquées</h2>
          <BlockForm kind="ip" />
          <List rows={ips} />
        </section>
      </div>
      <section className={card}>
        <h2 className="font-black">Pays autorisés</h2>
        <CountriesForm countries={COUNTRIES} allowed={v.allowedCountries} />
      </section>
      <p className="text-xs text-gray-500">Le blocage des VPN / centres de données nécessiterait un service externe payant : non activé.</p>
    </div>
  )
}
