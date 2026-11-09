import VoyagesClient from "./VoyagesClient"

// Page régénérée toutes les heures : la date du jour (Tunis) sert à ne PAS afficher un départ dont la date est passée.
export const revalidate = 3600

const tunisToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis" }).format(new Date())

export default function VoyagesOrganisesPage() {
  return <VoyagesClient initialToday={tunisToday()} />
}
