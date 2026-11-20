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

// FAQ des pages « sur devis » (E-Visa) : sans prix ni délai ; reprend la mention de la brochure (acceptation finale par les autorités du pays).
const QUOTE = {
  fr: [
    { q: "Comment obtenir un devis ?", a: "Choisissez votre destination dans le formulaire. Un conseiller Easy2Book vous recontacte avec le devis et la liste des documents à fournir pour cette destination." },
    { q: "Une E-Visa signifie-t-elle voyager sans visa ?", a: "Non. L'E-Visa est une demande de visa faite en ligne, sans passer par l'ambassade. Elle reste obligatoire : les conditions varient selon le pays, la nationalité et la durée du séjour, et l'acceptation finale relève exclusivement des autorités du pays concerné." },
    { q: "Ma destination n'est pas dans la liste ?", a: "Choisissez « Autre destination » et indiquez-la à notre conseiller : nous vérifions avec vous si une demande en ligne est possible." },
    { q: "Où envoyer mes documents ?", a: "Ne les envoyez pas dans le formulaire. Votre conseiller vous indiquera comment les transmettre par WhatsApp." },
  ],
  en: [
    { q: "How do I get a quote?", a: "Choose your destination in the form. An Easy2Book advisor will contact you with the quote and the list of documents required for that destination." },
    { q: "Does an e-Visa mean travelling without a visa?", a: "No. An e-Visa is a visa application made online, without going to the embassy. It remains mandatory: requirements vary by country, nationality and length of stay, and final approval rests solely with the authorities of the country concerned." },
    { q: "My destination is not in the list?", a: "Choose \"Other destination\" and tell our advisor: we check with you whether an online application is possible." },
    { q: "Where do I send my documents?", a: "Do not send them in the form. Your advisor will tell you how to send them by WhatsApp." },
  ],
  ar: [
    { q: "كيف أحصل على عرض سعر؟", a: "اختر وجهتك في النموذج. سيتصل بك مستشار Easy2Book ويرسل لك عرض السعر وقائمة الوثائق المطلوبة لهذه الوجهة." },
    { q: "هل تعني تأشيرة E-Visa السفر «بدون فيزا»؟", a: "لا. الـ E-Visa هي تأشيرة يتم التقديم عليها عن بُعد دون الحاجة إلى السفارة، وتبقى مطلوبة رسمياً. شروطها تختلف حسب البلد والجنسية ومدة الإقامة، والقبول النهائي يبقى من اختصاص سلطات البلد المعني." },
    { q: "وجهتي غير موجودة في القائمة؟", a: "اختر «وجهة أخرى» وأخبر مستشارنا: نتحقق معك إن كان التقديم الإلكتروني ممكناً." },
    { q: "أين أرسل وثائقي؟", a: "لا ترسلها في النموذج. سيوضح لك المستشار كيفية إرسالها عبر واتساب." },
  ],
}

export function faqFor(family: Family, lang: "fr" | "ar" | "en", quote = false): Faq[] {
  if (quote) return QUOTE[lang]
  const extra = SPECIFIC[family][lang]
  return extra ? [...COMMON[lang], extra] : COMMON[lang]
}
