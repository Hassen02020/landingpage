// FAQ GÉNÉRIQUE de la page publique : elle ne décrit que le PROCESSUS de réservation (jamais un prix, une date, une prestation ni un avis inventés).
import type { Family } from "./themes"

export interface Faq { q: string; a: string }

const COMMON = {
  fr: [
    { q: "Comment réserver ?", a: "Remplissez le formulaire ou écrivez-nous sur WhatsApp. Un conseiller Easy2Book vous recontacte pour confirmer les disponibilités et finaliser votre réservation." },
    { q: "Les prix affichés sont-ils définitifs ?", a: "Les prix sont indicatifs : un conseiller les confirme selon vos dates et le nombre de voyageurs." },
    { q: "Puis-je poser une question avant de réserver ?", a: "Oui, par WhatsApp ou par téléphone, sans engagement." },
  ],
  en: [
    { q: "How do I book?", a: "Fill in the form or write to us on WhatsApp. An Easy2Book advisor will call you back to confirm availability and complete your booking." },
    { q: "Are the prices shown final?", a: "Prices are indicative: an advisor confirms them according to your dates and the number of travellers." },
    { q: "Can I ask a question before booking?", a: "Yes, by WhatsApp or by phone, with no commitment." },
  ],
  ar: [
    { q: "كيف يمكنني الحجز؟", a: "املأ النموذج أو راسلنا على واتساب، وسيتصل بك مستشار Easy2Book لتأكيد التوفر وإتمام الحجز." },
    { q: "هل الأسعار المعروضة نهائية؟", a: "الأسعار إرشادية ويؤكدها المستشار حسب تواريخك وعدد المسافرين." },
    { q: "هل يمكنني طرح سؤال قبل الحجز؟", a: "نعم، عبر واتساب أو الهاتف دون أي التزام." },
  ],
}
const SPECIFIC: Record<Family, Record<"fr" | "ar" | "en", Faq | null>> = {
  omra: { fr: { q: "Les places sont-elles limitées ?", a: "Le nombre de places est indiqué sur chaque départ lorsqu'il est suivi : confirmez la disponibilité avec un conseiller." }, ar: { q: "هل عدد المقاعد محدود؟", a: "يُذكر عدد المقاعد في كل رحلة عند تتبعه؛ أكد التوفر مع المستشار." }, en: { q: "Are places limited?", a: "The number of places is shown on each departure when it is tracked: confirm availability with an advisor." } },
  voyage: { fr: { q: "Que comprend le prix ?", a: "Les prestations incluses sont détaillées sur chaque offre ; un conseiller vous confirme les détails." }, ar: { q: "ماذا يشمل السعر؟", a: "تُفصَّل الخدمات المشمولة في كل عرض ويؤكد لك المستشار التفاصيل." }, en: { q: "What does the price include?", a: "Included services are detailed on each offer; an advisor confirms the details." } },
  hotel: { fr: { q: "Comment connaître le prix pour mes dates ?", a: "Le prix affiché est indicatif : un conseiller vous confirme le tarif exact selon vos dates." }, ar: { q: "كيف أعرف السعر لتواريخي؟", a: "السعر المعروض إرشادي ويؤكد لك المستشار السعر الدقيق حسب تواريخك." }, en: { q: "How do I know the price for my dates?", a: "The displayed price is indicative: an advisor confirms the exact rate for your dates." } },
  autre: { fr: null, ar: null, en: null },
}

export function faqFor(family: Family, lang: "fr" | "ar" | "en"): Faq[] {
  const extra = SPECIFIC[family][lang]
  return extra ? [...COMMON[lang], extra] : COMMON[lang]
}
