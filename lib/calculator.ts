// Calculateur de rentabilité d'une campagne (voyages / Omra). Fonction pure, utilisée par /admin/calculateur.
export interface CalcInput {
  costPerLead: number // coût moyen d'un lead (TND)
  leads: number // leads reçus
  contactRate: number // % de leads joints par l'équipe
  bookingRate: number // % de réservations parmi les leads joints
  peoplePerBooking: number // personnes par réservation
  pricePerPerson: number // prix de vente par personne (TND)
  costPerPerson: number // coût du forfait par personne : billet, hôtel, visa… (TND)
  otherCostPerBooking: number // autres frais par réservation : commission, appels, cadeaux… (TND)
}

export interface CalcResult {
  adBudget: number
  contacted: number
  bookings: number
  people: number
  revenue: number
  grossMargin: number
  profit: number
  costPerBooking: number
  profitPerPerson: number
  roas: number
  breakEvenCostPerLead: number // coût par lead maximal pour ne pas perdre d'argent
  overallBookingRate: number // réservations / leads reçus (%)
}

const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0)
const pct = (v: number) => Math.min(100, n(v)) / 100

export function calculate(i: CalcInput): CalcResult {
  const leads = n(i.leads)
  const adBudget = n(i.costPerLead) * leads
  const contacted = leads * pct(i.contactRate)
  const bookings = contacted * pct(i.bookingRate)
  const people = bookings * n(i.peoplePerBooking)
  const revenue = people * n(i.pricePerPerson)
  const grossMargin = people * (n(i.pricePerPerson) - n(i.costPerPerson)) - bookings * n(i.otherCostPerBooking)
  const profit = grossMargin - adBudget
  return {
    adBudget,
    contacted,
    bookings,
    people,
    revenue,
    grossMargin,
    profit,
    costPerBooking: bookings ? adBudget / bookings : 0,
    profitPerPerson: people ? profit / people : 0,
    roas: adBudget ? revenue / adBudget : 0,
    breakEvenCostPerLead: leads ? Math.max(0, grossMargin) / leads : 0,
    overallBookingRate: leads ? (bookings / leads) * 100 : 0,
  }
}
