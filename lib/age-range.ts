// Tranche d'âge DÉCLARÉE (facultative) : jamais déduite d'un nom, d'une photo ou d'un autre signal, jamais envoyée à Meta / TikTok.
// Les valeurs sont celles de la contrainte SQL de la migration 0027 (non appliquée tant que le propriétaire ne l'a pas décidé).
export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"] as const
export type AgeRange = (typeof AGE_RANGES)[number]
export const isAgeRange = (v: unknown): v is AgeRange => typeof v === "string" && (AGE_RANGES as readonly string[]).includes(v)

export const AGE_LABELS: Record<AgeRange, { fr: string; en: string; ar: string }> = {
  "18-24": { fr: "18 – 24 ans", en: "18 – 24", ar: "18 – 24 سنة" },
  "25-34": { fr: "25 – 34 ans", en: "25 – 34", ar: "25 – 34 سنة" },
  "35-44": { fr: "35 – 44 ans", en: "35 – 44", ar: "35 – 44 سنة" },
  "45-54": { fr: "45 – 54 ans", en: "45 – 54", ar: "45 – 54 سنة" },
  "55+": { fr: "55 ans et plus", en: "55 and over", ar: "55 سنة فأكثر" },
}

/**
 * Textes du champ. Le texte d'information (`note`) est PROPOSÉ au propriétaire : à valider avant d'activer le champ sur une page.
 * « Je préfère ne pas répondre » = valeur vide : rien n'est enregistré.
 */
export const AGE_TEXT = {
  fr: { label: "Tranche d'âge (facultatif)", none: "Je préfère ne pas répondre", note: "Facultatif : votre tranche d'âge nous aide à adapter nos offres. Elle n'est pas partagée avec des tiers." },
  en: { label: "Age range (optional)", none: "I prefer not to answer", note: "Optional: your age range helps us tailor our offers. It is not shared with third parties." },
  ar: { label: "الفئة العمرية (اختياري)", none: "أفضّل عدم الإجابة", note: "اختياري: تساعدنا فئتك العمرية على تحسين عروضنا. لا تتم مشاركتها مع أي طرف ثالث." },
} as const
