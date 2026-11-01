export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Tunis", dateStyle: "short", timeStyle: "short" }).format(new Date(iso))
}

export const STATUS_COLORS: Record<string, string> = {
  nouveau: "bg-blue-100 text-blue-800",
  contacte: "bg-amber-100 text-amber-800",
  qualifie: "bg-purple-100 text-purple-800",
  reserve: "bg-green-100 text-green-800",
  perdu: "bg-gray-200 text-gray-600",
}
