// Promos hôtels Tunisie (source : promos_hotels_tunisie_active_travel.xlsx, 29 hôtels).
// Réduction en %, prix « à partir de » en TND (valeurs EXACTES du fichier, sans arrondi : le dinar a 3 décimales) PAR PERSONNE ET PAR NUIT (base confirmée par le propriétaire le 09/11/2026) : tarif indicatif,
// confirmé sur WhatsApp. Les colonnes « Type de séjour » et « Validité des dates » du fichier sont vides : aucune date n'est affichée.
// La remarque ambiguë « 1er -5 ans » (Laico Hammamet) n'est volontairement pas affichée. Les liens du fichier ne sont pas utilisés.
export interface HotelPromo {
  name: string
  city: string
  /** réduction, en % */
  discount: number
  /** prix « à partir de », TND par personne et par nuit */
  priceFrom: number
  note: string | null
}

export const HOTEL_PROMOS: HotelPromo[] = [
  {
    "name": "Occidental Sousse Marhaba (Ex Marhaba Resort)",
    "city": "Sousse",
    "discount": 11,
    "priceFrom": 98,
    "note": null
  },
  {
    "name": "Medina Regency Tunis Hotel",
    "city": "Tunis",
    "discount": 10,
    "priceFrom": 136.7,
    "note": null
  },
  {
    "name": "Houria Palace",
    "city": "Sousse",
    "discount": 44,
    "priceFrom": 58.7,
    "note": null
  },
  {
    "name": "Club Palm Azur",
    "city": "Djerba",
    "discount": 30,
    "priceFrom": 127.5,
    "note": null
  },
  {
    "name": "Djerba Resort",
    "city": "Djerba",
    "discount": 28,
    "priceFrom": 122.3,
    "note": null
  },
  {
    "name": "Iberostar Mehari Djerba",
    "city": "Djerba",
    "discount": 33,
    "priceFrom": 179.9,
    "note": null
  },
  {
    "name": "Iberostar Kuriat Palace",
    "city": "Monastir",
    "discount": 36,
    "priceFrom": 197.5,
    "note": null
  },
  {
    "name": "Iberostar Royal El Mansour",
    "city": "Mahdia",
    "discount": 36,
    "priceFrom": 155.5,
    "note": null
  },
  {
    "name": "Djerba Holiday Beach",
    "city": "Djerba",
    "discount": 25,
    "priceFrom": 126.4,
    "note": null
  },
  {
    "name": "Riviera Aquapark",
    "city": "Sousse",
    "discount": 20,
    "priceFrom": 98.6,
    "note": null
  },
  {
    "name": "Best Beach Hotel",
    "city": "Sousse",
    "discount": 48,
    "priceFrom": 44.5,
    "note": null
  },
  {
    "name": "Iberostar Waves Averroes",
    "city": "Hammamet",
    "discount": 40,
    "priceFrom": 160.125,
    "note": null
  },
  {
    "name": "Tmk Latrium",
    "city": "Hammamet",
    "discount": 20,
    "priceFrom": 87.3,
    "note": null
  },
  {
    "name": "Nesrine",
    "city": "Hammamet",
    "discount": 20,
    "priceFrom": 70.6,
    "note": null
  },
  {
    "name": "Laico Hammamet",
    "city": "Hammamet",
    "discount": 18,
    "priceFrom": 117.3,
    "note": null
  },
  {
    "name": "Menara Hammamet",
    "city": "Hammamet",
    "discount": 35,
    "priceFrom": 56.7,
    "note": null
  },
  {
    "name": "Marhaba Club",
    "city": "Sousse",
    "discount": 34,
    "priceFrom": 94,
    "note": "Réservé aux non-célibataires"
  },
  {
    "name": "Concorde Marco Polo",
    "city": "Hammamet",
    "discount": 20,
    "priceFrom": 121.3,
    "note": null
  },
  {
    "name": "Marina Palace",
    "city": "Hammamet",
    "discount": 25,
    "priceFrom": 66.5,
    "note": null
  },
  {
    "name": "Iberostar Selection Kantaoui Bay",
    "city": "Sousse",
    "discount": 36,
    "priceFrom": 200,
    "note": null
  },
  {
    "name": "Iberostar Selection Eolia Djerba",
    "city": "Djerba",
    "discount": 33,
    "priceFrom": 222.2,
    "note": null
  },
  {
    "name": "Seabel Alhambra Beach Golf & Spa",
    "city": "Sousse",
    "discount": 10,
    "priceFrom": 191.875,
    "note": null
  },
  {
    "name": "Concorde Green Park Palace",
    "city": "Sousse",
    "discount": 20,
    "priceFrom": 141.1,
    "note": null
  },
  {
    "name": "Oceana Hotel & Spa",
    "city": "Hammamet",
    "discount": 20,
    "priceFrom": 135.4,
    "note": null
  },
  {
    "name": "Dreams Beach",
    "city": "Sousse",
    "discount": 43,
    "priceFrom": 47,
    "note": null
  },
  {
    "name": "The Mirage Resort And Spa Hammamet",
    "city": "Hammamet",
    "discount": 40,
    "priceFrom": 122,
    "note": null
  },
  {
    "name": "Sol Palmeras Beach",
    "city": "Sousse",
    "discount": 25,
    "priceFrom": 35.2,
    "note": "Premier enfant de moins de 6 ans gratuit"
  },
  {
    "name": "Iberostar Selection Diar El Andalous",
    "city": "Sousse",
    "discount": 36,
    "priceFrom": 176.8,
    "note": null
  },
  {
    "name": "Tmk Flora Park",
    "city": "Hammamet",
    "discount": 15,
    "priceFrom": 83.3,
    "note": null
  }
]
