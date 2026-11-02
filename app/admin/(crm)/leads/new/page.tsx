import { PRODUCTS } from "@/lib/config"
import { SOURCE_LABELS } from "@/lib/server/crm"
import { createLeadAction } from "../../../actions"

export default function NewLeadPage({ searchParams }: { searchParams: { erreur?: string } }) {
  const input = "w-full px-3 py-2 rounded-lg border"
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-black">Nouveau lead</h1>
      <p className="text-sm text-gray-500">Pour un prospect arrivé par WhatsApp ou par téléphone, sans passer par le formulaire.</p>
      {searchParams.erreur && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{searchParams.erreur}</div>}
      <form action={createLeadAction} className="bg-white rounded-2xl shadow-sm p-4 space-y-3 text-sm">
        <input name="name" required placeholder="Nom complet" className={input} />
        <input name="phone" required placeholder="Téléphone (98 140 514 ou +33…)" className={input} />
        <select name="product" required className={input}>
          {Object.entries(PRODUCTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="source" required className={input}>
          {(["whatsapp", "phone", "manual"] as const).map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
        </select>
        <input name="offer" placeholder="Offre (facultatif)" className={input} />
        <input name="destination" placeholder="Destination (facultatif)" className={input} />
        <textarea name="message" rows={3} placeholder="Détails de la demande (facultatif)" className={input} />
        <p className="text-xs text-gray-500">Le prospect nous a contactés lui-même : le recontact au sujet de sa demande est autorisé. Aucun consentement marketing n'est enregistré.</p>
        <button className="w-full bg-violet-700 text-white font-bold py-2 rounded-lg">Créer le lead</button>
      </form>
    </div>
  )
}
