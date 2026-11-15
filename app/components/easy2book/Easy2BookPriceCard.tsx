/** Carte de prix compacte (nom, prix par personne, remarque, bouton) : variante allégée de la carte d'offre, pour les tarifs par type de chambre ou de formule. */
export function Easy2BookPriceCard({ title, price, unit, note, ctaLabel, onSelect, highlight = false }: { title: string; price: string; unit: string; note?: string; ctaLabel: string; onSelect: () => void; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 text-center bg-white ${highlight ? "border-2 border-e2b-yellow" : "border border-gray-200"}`} data-testid="price-card">
      <h3 className="font-black text-sm">{title}</h3>
      <p className="mt-1 text-3xl font-black text-e2b-blue"><span dir="ltr">{price}</span> <span className="text-sm font-bold text-gray-600">{unit}</span></p>
      {note && <p className="mt-1 text-xs text-gray-600">{note}</p>}
      <button type="button" onClick={onSelect} className="mt-3 w-full text-white font-black py-2.5 rounded-xl bg-e2b-blue hover:bg-e2b-blue-dark">{ctaLabel}</button>
    </div>
  )
}
