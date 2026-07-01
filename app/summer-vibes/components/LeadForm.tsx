"use client"

import { useState } from "react"
import { saveLead, type Lead } from "../../../lib/supabase"

const WHATSAPP_NUMBER = "98140514"

interface LeadFormProps {
  onCtaClick?: (location: string) => void
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

export function LeadForm({ onCtaClick }: LeadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const trackMetaLead = (leadData: Lead) => {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "Lead", {
        content_name: "Summer Vibes Lead Form",
        content_category: leadData.trip_type,
        destination: leadData.destination,
        tripType: leadData.trip_type,
        value: 1,
        currency: "TND",
      })
    }
  }

  const trackMetaContact = () => {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "Contact", {
        channel: "WhatsApp",
      })
    }
  }

  const validatePhone = (phone: string): boolean => {
    const tunisiaPhoneRegex = /^(2|4|5|9)\d{7}$/
    return tunisiaPhoneRegex.test(phone)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const form = e.target as HTMLFormElement
      const name = (form.elements.namedItem('name') as HTMLInputElement).value
      const phone = (form.elements.namedItem('phone') as HTMLInputElement).value
      const destination = (form.elements.namedItem('destination') as HTMLSelectElement).value
      const date = (form.elements.namedItem('date') as HTMLInputElement).value
      const adults = (form.elements.namedItem('adults') as HTMLSelectElement).value
      const children = (form.elements.namedItem('children') as HTMLSelectElement).value
      const tripType = (form.elements.namedItem('tripType') as HTMLSelectElement).value
      const budget = (form.elements.namedItem('budget') as HTMLSelectElement).value

      // Validation téléphone Tunisie
      if (!validatePhone(phone)) {
        setError("Numéro de téléphone invalide. Doit être un numéro tunisien (8 chiffres commençant par 2, 4, 5 ou 9).")
        setIsSubmitting(false)
        return
      }

      const leadData: Omit<Lead, 'id' | 'created_at'> = {
        name,
        phone,
        destination,
        travel_date: date,
        adults: parseInt(adults),
        children: parseInt(children),
        trip_type: tripType,
        budget,
        source: "landing_easy2book",
      }

      // 1. Sauvegarder le lead dans Supabase
      await saveLead(leadData)

      // 2. Déclencher l'événement Meta Lead
      trackMetaLead(leadData)

      // 3. Ouvrir WhatsApp
      const message = encodeURIComponent(
        `Bonjour Easy2Book, je souhaite avoir un devis pour Summer Vibes 2026 !\n\nNom: ${name}\nTéléphone: ${phone}\nDestination: ${destination}\nDate: ${date}\nAdultes: ${adults}\nEnfants: ${children}\nType voyage: ${tripType}\nBudget: ${budget}`
      )
      trackMetaContact()
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank')

      // 4. Succès
      setSuccess(true)
      onCtaClick?.('lead-form')
      
      // Reset du formulaire
      form.reset()
    } catch (err) {
      console.error('Erreur lors de la soumission du formulaire:', err)
      setError("Une erreur s'est produite. Veuillez réessayer ou nous contacter directement sur WhatsApp.")
      
      // En cas d'erreur, ouvrir quand même WhatsApp
      const form = e.target as HTMLFormElement
      const name = (form.elements.namedItem('name') as HTMLInputElement).value
      const phone = (form.elements.namedItem('phone') as HTMLInputElement).value
      const message = encodeURIComponent(
        `Bonjour Easy2Book, je souhaite avoir un devis pour Summer Vibes 2026 !\n\nNom: ${name}\nTéléphone: ${phone}`
      )
      trackMetaContact()
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
          ✓ Votre demande a été enregistrée avec succès !
        </div>
      )}

      <div>
        <input
          name="name"
          type="text"
          placeholder="Votre nom complet"
          required
          disabled={isSubmitting}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
      <div>
        <input
          name="phone"
          type="tel"
          placeholder="Votre numéro de téléphone"
          required
          disabled={isSubmitting}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
      <div>
        <select
          name="destination"
          required
          disabled={isSubmitting}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Destination souhaitée</option>
          <option value="Hammamet">Hammamet</option>
          <option value="Sousse">Sousse</option>
          <option value="Monastir">Monastir</option>
          <option value="Djerba">Djerba</option>
          <option value="Mahdia">Mahdia</option>
          <option value="Tabarka">Tabarka</option>
        </select>
      </div>
      <div>
        <input
          name="date"
          type="date"
          required
          disabled={isSubmitting}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <select
            name="adults"
            required
            disabled={isSubmitting}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Adultes</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4+</option>
          </select>
        </div>
        <div>
          <select
            name="children"
            required
            disabled={isSubmitting}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Enfants</option>
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3+</option>
          </select>
        </div>
      </div>
      <div>
        <select
          name="tripType"
          required
          disabled={isSubmitting}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Type de voyage</option>
          <option value="Famille">Famille</option>
          <option value="Voyage de noces">Voyage de noces</option>
          <option value="Affaires">Affaires</option>
          <option value="Weekend">Weekend</option>
        </select>
      </div>
      <div>
        <select
          name="budget"
          required
          disabled={isSubmitting}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Budget approximatif</option>
          <option value="100-200 TND">100 - 200 TND / nuit</option>
          <option value="200-300 TND">200 - 300 TND / nuit</option>
          <option value="300-500 TND">300 - 500 TND / nuit</option>
          <option value="500+ TND">500+ TND / nuit</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-lg font-extrabold shadow-xl transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: "#25D366", color: "#fff" }}
      >
        {isSubmitting ? (
          <>
            <span className="animate-spin">⏳</span>
            Envoi en cours...
          </>
        ) : (
          "🟢 Continuer vers WhatsApp"
        )}
      </button>
    </form>
  )
}
