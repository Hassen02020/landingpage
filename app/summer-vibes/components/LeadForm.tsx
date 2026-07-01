"use client"

const WHATSAPP_NUMBER = "21698140514"

interface LeadFormProps {
  onCtaClick?: (location: string) => void
}

export function LeadForm({ onCtaClick }: LeadFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const name = (form.elements.namedItem('name') as HTMLInputElement).value
    const phone = (form.elements.namedItem('phone') as HTMLInputElement).value
    const destination = (form.elements.namedItem('destination') as HTMLSelectElement).value
    const date = (form.elements.namedItem('date') as HTMLInputElement).value
    const adults = (form.elements.namedItem('adults') as HTMLSelectElement).value
    const children = (form.elements.namedItem('children') as HTMLSelectElement).value
    const tripType = (form.elements.namedItem('tripType') as HTMLSelectElement).value
    const budget = (form.elements.namedItem('budget') as HTMLSelectElement).value

    const message = encodeURIComponent(
      `Bonjour Easy2Book, je souhaite avoir un devis pour Summer Vibes 2026 !\n\nNom: ${name}\nTéléphone: ${phone}\nDestination: ${destination}\nDate: ${date}\nAdultes: ${adults}\nEnfants: ${children}\nType voyage: ${tripType}\nBudget: ${budget}`
    )
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank')
    onCtaClick?.('lead-form')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          name="name"
          type="text"
          placeholder="Votre nom complet"
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <input
          name="phone"
          type="tel"
          placeholder="Votre numéro de téléphone"
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <select
          name="destination"
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <select
            name="adults"
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-lg font-extrabold shadow-xl transition-all hover:brightness-110 active:scale-95"
        style={{ backgroundColor: "#25D366", color: "#fff" }}
      >
        🟢 Continuer vers WhatsApp
      </button>
    </form>
  )
}
