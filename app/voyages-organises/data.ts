// Voyages organisés — départs valables au 09/11/2026 (source : voyages_organises_easy2book.xlsx, feuille « Voyages valables »).
// Le fichier donne UN premier départ par voyage ; le programme détaillé est « sur demande ». Aucune prestation, photo ou description
// n'est inventée : seules les informations du fichier sont affichées. Un départ dont la date est passée n'est pas affiché.
export type VoyageCategory = "Premium" | "Individuel garanti" | "Standard"

export interface Voyage {
  id: string
  category: VoyageCategory
  destination: string
  title: string
  /** premier départ, AAAA-MM-JJ */
  departIso: string
  duration: string
  /** « avec » : le fichier indique « Avec visa » ; « non_precise » : le fichier indique « Non précisé » */
  visa: "avec" | "non_precise"
  /** prix « à partir de », TND par personne */
  priceFrom: number
}

export const VOYAGE_CATEGORIES: VoyageCategory[] = ["Premium", "Individuel garanti", "Standard"]

export const VOYAGES: Voyage[] = [
  {
    "id": "australie-melbourne-cairns-sydney-2026-11-14",
    "category": "Premium",
    "destination": "Australie",
    "title": "Australie (Melbourne · Cairns · Sydney)",
    "departIso": "2026-11-14",
    "duration": "14 jours",
    "visa": "non_precise",
    "priceFrom": 18500
  },
  {
    "id": "egypte-au-fil-du-nil-2026-11-15",
    "category": "Premium",
    "destination": "Égypte",
    "title": "Égypte au fil du Nil",
    "departIso": "2026-11-15",
    "duration": "9 jours",
    "visa": "non_precise",
    "priceFrom": 7400
  },
  {
    "id": "japon-l-odyssee-du-soleil-levant-2026-11-18",
    "category": "Premium",
    "destination": "Japon",
    "title": "Japon : L'Odyssée du Soleil Levant",
    "departIso": "2026-11-18",
    "duration": "11 jours",
    "visa": "non_precise",
    "priceFrom": 15400
  },
  {
    "id": "sri-lanka-maldives-2026-12-10",
    "category": "Premium",
    "destination": "Sri Lanka / Maldives",
    "title": "Sri Lanka & Maldives",
    "departIso": "2026-12-10",
    "duration": "13 jours / 10 nuits",
    "visa": "avec",
    "priceFrom": 13890
  },
  {
    "id": "jordanie-2027-03-16",
    "category": "Premium",
    "destination": "Jordanie",
    "title": "Jordanie",
    "departIso": "2027-03-16",
    "duration": "7 jours / 6 nuits",
    "visa": "non_precise",
    "priceFrom": 5850
  },
  {
    "id": "argentine-buenos-aires-ushuaia-el-calafate-iguaz-2027-04-09",
    "category": "Premium",
    "destination": "Argentine",
    "title": "Argentine (Buenos Aires, Ushuaia, El Calafate, Iguazú)",
    "departIso": "2027-04-09",
    "duration": "12 jours / 10 nuits",
    "visa": "non_precise",
    "priceFrom": 17400
  },
  {
    "id": "chine-2027-04-15",
    "category": "Premium",
    "destination": "Chine",
    "title": "Chine",
    "departIso": "2027-04-15",
    "duration": "16 jours / 13 nuits",
    "visa": "avec",
    "priceFrom": 12300
  },
  {
    "id": "ouzbekistan-sur-les-traces-de-la-route-de-la-soi-2027-05-06",
    "category": "Premium",
    "destination": "Ouzbékistan",
    "title": "Ouzbékistan (Sur les traces de la Route de la Soie)",
    "departIso": "2027-05-06",
    "duration": "11 jours / 10 nuits",
    "visa": "avec",
    "priceFrom": 8800
  },
  {
    "id": "bresil-2027-01-18",
    "category": "Premium",
    "destination": "Brésil",
    "title": "Brésil",
    "departIso": "2027-01-18",
    "duration": "11 jours",
    "visa": "non_precise",
    "priceFrom": 16300
  },
  {
    "id": "circuit-andalousie-2026-11-14",
    "category": "Individuel garanti",
    "destination": "Espagne",
    "title": "Circuit Andalousie",
    "departIso": "2026-11-14",
    "duration": "8 jours / 7 nuits",
    "visa": "avec",
    "priceFrom": 4050
  },
  {
    "id": "laponie-feerique-2027-01-02",
    "category": "Individuel garanti",
    "destination": "Finlande",
    "title": "Laponie féerique",
    "departIso": "2027-01-02",
    "duration": "8 jours / 7 nuits",
    "visa": "avec",
    "priceFrom": 7320
  },
  {
    "id": "le-kenya-entre-safari-et-plage-2027-01-05",
    "category": "Individuel garanti",
    "destination": "Kenya",
    "title": "Le Kenya, entre safari et plage",
    "departIso": "2027-01-05",
    "duration": "9 jours / 8 nuits",
    "visa": "non_precise",
    "priceFrom": 5530
  },
  {
    "id": "argentine-glaciers-de-patagonie-et-chutes-d-igua-2027-01-20",
    "category": "Individuel garanti",
    "destination": "Argentine",
    "title": "Argentine : glaciers de Patagonie et chutes d'Iguazú",
    "departIso": "2027-01-20",
    "duration": "15 jours / 14 nuits",
    "visa": "avec",
    "priceFrom": 26820
  },
  {
    "id": "les-secrets-du-japon-2027-03-15",
    "category": "Individuel garanti",
    "destination": "Japon",
    "title": "Les secrets du Japon",
    "departIso": "2027-03-15",
    "duration": "13 jours / 12 nuits",
    "visa": "non_precise",
    "priceFrom": 13300
  },
  {
    "id": "symphonie-polonaise-2027-05-10",
    "category": "Individuel garanti",
    "destination": "Pologne",
    "title": "Symphonie polonaise",
    "departIso": "2027-05-10",
    "duration": "9 jours / 8 nuits",
    "visa": "avec",
    "priceFrom": 5250
  },
  {
    "id": "istanbul-special-shopping-2026-11-09",
    "category": "Standard",
    "destination": "Turquie",
    "title": "Istanbul Spécial shopping",
    "departIso": "2026-11-09",
    "duration": "7 jours / 6 nuits",
    "visa": "non_precise",
    "priceFrom": 1950
  },
  {
    "id": "istanbul-vacances-decembre-2026-2026-12-13",
    "category": "Standard",
    "destination": "Turquie",
    "title": "Istanbul Vacances Décembre 2026",
    "departIso": "2026-12-13",
    "duration": "7 jours / 6 nuits",
    "visa": "non_precise",
    "priceFrom": 2720
  },
  {
    "id": "marrakech-essaouira-rabat-et-casa-2026-12-14",
    "category": "Standard",
    "destination": "Maroc",
    "title": "Marrakech, Essaouira, Rabat et Casa",
    "departIso": "2026-12-14",
    "duration": "7 jours / 6 nuits",
    "visa": "non_precise",
    "priceFrom": 3450
  },
  {
    "id": "luxor-hurghada-et-caire-2026-12-16",
    "category": "Standard",
    "destination": "Égypte",
    "title": "Luxor, Hurghada et Caire",
    "departIso": "2026-12-16",
    "duration": "8 jours / 7 nuits",
    "visa": "non_precise",
    "priceFrom": 5690
  }
]
