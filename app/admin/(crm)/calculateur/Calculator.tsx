"use client"

import { useMemo, useState } from "react"
import { calculate, type CalcInput } from "@/lib/calculator"

type Real = { leads: number; contactRate: number; bookingRate: number; avgBasket: number } | null

const FIELDS: { key: keyof CalcInput; label: string; unit: string; help?: string }[] = [
  { key: "costPerLead", label: "Coût par lead", unit: "TND", help: "Dépense pub ÷ leads (Meta / TikTok)" },
  { key: "leads", label: "Leads reçus", unit: "leads" },
  { key: "contactRate", label: "Taux de contact", unit: "%", help: "Leads joints par l'équipe" },
  { key: "bookingRate", label: "Taux de réservation", unit: "%", help: "Parmi les leads joints" },
  { key: "peoplePerBooking", label: "Personnes par réservation", unit: "pers." },
  { key: "pricePerPerson", label: "Prix de vente par personne", unit: "TND" },
  { key: "costPerPerson", label: "Coût du forfait par personne", unit: "TND", help: "Billet, hôtel, visa, transport…" },
  { key: "otherCostPerBooking", label: "Autres frais par réservation", unit: "TND", help: "Commission, appels, cadeaux…" },
]

const DEFAULTS: CalcInput = {
  costPerLead: 8,
  leads: 100,
  contactRate: 80,
  bookingRate: 10,
  peoplePerBooking: 2,
  pricePerPerson: 5500,
  costPerPerson: 4800,
  otherCostPerBooking: 50,
}

const fmt = (n: number, d = 0) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d }).format(n)

export function Calculator({ real }: { real: Real }) {
  const [input, setInput] = useState<CalcInput>(DEFAULTS)
  const r = useMemo(() => calculate(input), [input])
  const set = (k: keyof CalcInput, v: string) => setInput((s) => ({ ...s, [k]: Number(v.replace(",", ".")) || 0 }))

  const cards = [
    { label: "Budget publicitaire", value: `${fmt(r.adBudget)} TND` },
    { label: "Leads joints", value: fmt(r.contacted, 1) },
    { label: "Réservations", value: fmt(r.bookings, 1), sub: `${fmt(r.overallBookingRate, 1)} % des leads` },
    { label: "Personnes", value: fmt(r.people, 1) },
    { label: "Chiffre d'affaires", value: `${fmt(r.revenue)} TND` },
    { label: "Marge brute", value: `${fmt(r.grossMargin)} TND`, sub: "avant publicité" },
    { label: "Profit net", value: `${fmt(r.profit)} TND`, tone: r.profit >= 0 ? "text-green-700" : "text-red-700" },
    { label: "Coût pub par réservation", value: `${fmt(r.costPerBooking)} TND` },
    { label: "Profit par personne", value: `${fmt(r.profitPerPerson)} TND` },
    { label: "ROAS", value: `${fmt(r.roas, 1)} ×`, sub: "CA ÷ budget pub" },
    { label: "Coût par lead maximal", value: `${fmt(r.breakEvenCostPerLead, 2)} TND`, sub: "au-delà : campagne à perte", tone: input.costPerLead > r.breakEvenCostPerLead ? "text-red-700" : "text-green-700" },
  ]

  return (
    <div className="space-y-5">
      {real && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 text-sm flex flex-wrap items-center justify-between gap-3">
          <span>
            Vos chiffres réels (90 j, {real.leads} leads) : contact {real.contactRate} %, réservation {real.bookingRate} %
            {real.avgBasket ? `, panier moyen ${fmt(real.avgBasket)} TND` : ""}.
          </span>
          <button
            type="button"
            onClick={() => setInput((s) => ({ ...s, leads: real.leads, contactRate: real.contactRate, bookingRate: real.bookingRate }))}
            className="bg-violet-700 text-white font-bold px-3 py-1.5 rounded-lg"
          >
            Utiliser mes taux réels
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="bg-white rounded-2xl border border-gray-100 p-4 text-sm">
            <span className="font-bold">{f.label}</span>
            <span className="mt-2 flex items-center border rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-violet-500">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={input[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                className="w-full outline-none"
                aria-label={f.label}
              />
              <span className="text-gray-400 ml-2">{f.unit}</span>
            </span>
            {f.help && <span className="block text-xs text-gray-500 mt-1">{f.help}</span>}
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border-2 border-dashed border-violet-300 p-4 text-center">
            <div className="text-sm font-semibold text-gray-600">{c.label}</div>
            <div className={`text-xl font-black ${c.tone ?? "text-violet-800"}`}>{c.value}</div>
            {c.sub && <div className="text-xs text-gray-500">{c.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
