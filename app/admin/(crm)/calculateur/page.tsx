import { loadLeadStats, parsePeriod, rates, totals } from "@/lib/server/stats"
import { Calculator } from "./Calculator"

export const dynamic = "force-dynamic"

export default async function CalculatorPage() {
  // taux réels des 90 derniers jours, proposés comme point de départ
  const rows = await loadLeadStats(parsePeriod(undefined, undefined, 90)).catch(() => [])
  const c = totals(rows)
  const r = rates(c)
  const contacted = c.leads - c.toTreat
  const real =
    c.leads >= 10
      ? {
          leads: c.leads,
          // null = non calculable (dénominateur nul) : jamais remplacé par 0
          contactRate: r.treatmentRate === null ? null : Math.round(r.treatmentRate * 100),
          bookingRate: contacted > 0 ? Math.round((c.booked / contacted) * 100) : null,
          avgBasket: r.avgBasket === null ? null : Math.round(r.avgBasket),
        }
      : null
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Calculateur de rentabilité</h1>
        <p className="text-sm text-gray-600">Simulez une campagne : coût des leads, taux de contact et de réservation, marge par personne.</p>
      </div>
      <Calculator real={real} />
    </div>
  )
}
