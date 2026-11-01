// Dates en arabe (mois tunisiens : جانفي، فيفري…), identiques côté serveur et navigateur.
const MONTHS_TN = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]

export function arDate(iso: string): { full: string; short: string; month: string } {
  const [y, m, d] = iso.split("-").map(Number)
  const month = MONTHS_TN[(m || 1) - 1]
  return { full: `${d} ${month} ${y}`, short: `${d} ${month}`, month: `${month} ${y}` }
}
