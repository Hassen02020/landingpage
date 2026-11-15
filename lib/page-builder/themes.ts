// CRÉATEUR DE LANDING PAGES — modèles (thèmes). Fonctions et données PURES (testables).
// Un thème fixe : le produit, la langue par défaut, la famille visuelle de la page publique, les champs à renseigner et ceux qui sont OBLIGATOIRES.
// Rien n'est inventé : aucun prix, date, disponibilité, prestation ni avis n'est pré-rempli ; les exemples ne sont que des aides de saisie (« ex. … »).
//
// LIMITE ACTUELLE (aucune migration) : le thème n'est PAS enregistré en base ; la page publique choisit sa famille visuelle d'après le PRODUIT
// de la catégorie (omra / voyage / hotel / autre). Les 10 thèmes sont donc des préréglages de création (produit, langue, champs, aides).
import type { Product } from "@/lib/config"

export type Family = "omra" | "voyage" | "hotel" | "autre"
export type OfferField = "name" | "destination" | "departure_date" | "nights" | "nights_detail" | "price" | "price_before" | "seats_total" | "tag" | "features" | "description" | "image_url"

export interface Theme {
  id: string
  label: string
  tagline: string
  emoji: string
  product: Product
  family: Family
  lang: "fr" | "ar" | "en"
  /** champs d'une offre OBLIGATOIRES pour publier (en plus du nom et du prix, toujours obligatoires) */
  offerRequired: OfferField[]
  /** champs d'une offre proposés à l'écran (les autres sont masqués pour ne pas surcharger) */
  offerFields: OfferField[]
  /** aides de saisie (placeholders) : jamais enregistrées */
  hints: { name: string; headline: string; destination?: string; features?: string; description?: string }
  /**
   * PRÉRÉGLAGE confirmé par le propriétaire (données réelles, pas des exemples) : texte de la page, offres prêtes à compléter et personnalisation de départ.
   * Ni date de départ ni nombre de nuits n'y figurent : l'équipe les renseigne (obligatoires pour publier). Appliqué UNIQUEMENT à la création d'une page.
   */
  preset?: ThemePreset
}

export interface PresetOffer { name: string; destination: string; nights_detail: string; price: string; features: string[]; /** facultatifs : renseignés seulement quand le départ est connu (groupes Omra) */ departure_date?: string; nights?: string; tag?: string }
export interface ThemePreset {
  name: string
  /** adresse par défaut (un nom arabe ne permet pas d'en déduire une) ; modifiable tant que la page n'est pas publiée */
  slug: string
  headline: string
  description: string
  offers: PresetOffer[]
  /** personnalisation de départ (revalidée par sanitizeDesign à l'enregistrement) */
  design: Record<string, unknown>
}

const RAMADAN_FEATURES = ["طيران تونس – جدة – تونس", "تأشيرة العمرة", "تأطير كامل مع مرشدين مرافقين", "إقامة في فندق ميسان الملتزم بمكة المكرمة", "رحلة إلى المدينة المنورة"]
const RAMADAN_PRESET: ThemePreset = {
  name: "عمرة رمضان كامل",
  slug: "omra-ramadan-complet",
  headline: "عمرة رمضان الكل في مكة المكرمة… بسفر أسهل وقلب مطمئن",
  description: "برنامج متكامل من Easy2Book يشمل طيران تونس – جدة – تونس، التأشيرة، التأطير الديني والإداري خطوة بخطوة، إقامة مريحة في فندق ميسان الملتزم، ورحلة روحانية للمدينة المنورة. عدد الغرف محدود جداً.",
  offers: [
    { name: "غرفة رباعية أو خماسية", destination: "مكة المكرمة والمدينة المنورة", nights_detail: "شهر رمضان كامل — 4 أو 5 أشخاص في الغرفة", price: "5900", features: RAMADAN_FEATURES },
    { name: "غرفة ثلاثية", destination: "مكة المكرمة والمدينة المنورة", nights_detail: "شهر رمضان كامل — 3 أشخاص في الغرفة", price: "6400", features: RAMADAN_FEATURES },
    { name: "غرفة ثنائية", destination: "مكة المكرمة والمدينة المنورة", nights_detail: "شهر رمضان كامل — شخصان في الغرفة", price: "6900", features: RAMADAN_FEATURES },
  ],
  design: {
    colors: { preset: "famille", custom: "#003878" },
    hero: "split",
    cta: { label: "احجز مكانك الآن", whatsapp: true },
    deadline: "2026-12-15",
    // vidéo publicitaire : fichier du site (public/), chargé seulement au clic ; sa carte finale annonce la même échéance que la page
    blocks: [{ id: "vid0001", type: "video", title: "الفيديو الإعلاني", text: "", items: [], images: ["/omra-ramadan-complet-poster.jpg"], cta: "form", ctaLabel: "", video: "/omra-ramadan-complet.mp4" }],
    // les cartes « services » remplacent la liste des prestations (même contenu) : masquée par défaut, réaffichable dans « Personnaliser »
    sections: [{ key: "intro", visible: true }, { key: "block:vid0001", visible: true }, { key: "services", visible: true }, { key: "offers", visible: true }, { key: "conditions", visible: true }, { key: "inclusions", visible: false }, { key: "programme", visible: true }, { key: "testimonials", visible: false }, { key: "faq", visible: true }, { key: "form", visible: true }],
    // textes du brochure du propriétaire (prototype Easy2Book-omraramdhan2027), repris tels quels ; « مباشر » et les détails d'hôtel viennent du même prototype
    services: [
      { title: "طيران مباشر تونس – جدة – تونس", text: "رحلات منتظمة ومريحة مع استقبال ومرافقة من مطار تونس قرطاج حتى الوصول إلى مكة المكرمة." },
      { title: "تأشيرة وتأطير ديني وإداري", text: "إنجاز كامل إجراءات التأشيرة مع مرشدين مرافقين خطوة بخطوة في المناسك والزيارات." },
      { title: "فندق ميسان الملتزم بمكة", text: "إقامة مريحة ومنظمة للعائلات والأفراد مع خدمات متواصلة طوال شهر رمضان المبارك، مع خدمة التوصيل والنظافة اليومية." },
      { title: "رحلة روحانية للمدينة المنورة", text: "زيارة المسجد النبوي الشريف والروضة والمزارات التاريخية في أجواء هادئة ومؤطرة. إقامة هادئة في المنطقة المركزية ومجاورة للساحات النبوية." },
    ],
    // fiche commerciale confirmée par le propriétaire (15/11/2026) : départ, durée, acompte, réductions, bébé
    conditions: [
      { title: "موعد السفر والمدة", text: "الانطلاق يوم 8 فيفري 2027 (بداية شهر رمضان 1448 هـ) · المدة 30 يوماً." },
      { title: "العربون", text: "عربون 50% قبل 15 ديسمبر 2026." },
      { title: "تخفيض العائلات", text: "تخفيض 200 د.ت للشخص للعائلات انطلاقاً من شخصين." },
      { title: "تخفيض الأطفال", text: "تخفيض 15% للأطفال من 2 إلى 11 سنة." },
      { title: "الرضيع", text: "سعر الرضيع 450 د.ت." },
      { title: "المجموعات الكبيرة", text: "مجموعات تفوق 10 أشخاص: الاتصال على 98 140 514 للحصول على الإمكانية." },
      { title: "تنبيه التوفر", text: "عدد غرف محدود جداً · عرض صالح لـ 15 ديسمبر 2026." },
    ],
    // MASQUÉS par défaut : à réafficher (« Personnaliser » > Témoignages) seulement si ces avis sont réels et que les clients ont donné leur accord
    testimonials: [
      { name: "عبد الرزاق بن سالم وعائلته", place: "تونس العاصمة · حجز عائلي (4 أشخاص)", text: "سافرنا مع الوالدة والأسرة كاملة وكنّا متخوفين من إجراءات التأشيرة والتنقل في مكة. فريق Easy2Book استقبلنا خطوة بخطوة، الإقامة في فندق ميسان الملتزم كانت منظمة وهادئة، وتخفيض العائلات سهّل علينا الحجز من الأول." },
      { name: "سميرة العيادي", place: "صفاقس · مسافرة برفقة والدتها", text: "أكثر حاجة طمنتني هي وجود المرشدين المرافقين معنا في الطواف والسعي وكل الزيارات. حتى في أوقات الزحام في رمضان كان التنظيم محكماً والتواصل متواصلاً على مدار اليوم." },
      { name: "نزار ومريم القاسمي", place: "سوسة · رحلة زوجين", text: "البرنامج كان واضحاً من يوم الحجز في تونس: مواعيد الطيران مضبوطة، الغرف مطابقة تماماً للوصف، وزيارة المسجد النبوي والروضة الشريفة مرتبة بأعلى درجات السكينة والالتزام." },
      { name: "لطفي الحمروني", place: "نابل · مجموعة عائلية (6 أشخاص)", text: "تعاملنا مع Easy2Book كان مباشراً وواضحاً من أول اتصال على الرقم 98 140 514. استلمنا التأشيرات وتذاكر تونس – جدة – تونس في الموعد المحدد دون أي مفاجآت أو مصاريف إضافية." },
    ],
  },
}

// --- Un modèle par départ Omra (mêmes principes que « Omra Ramadan complet ») : données UNIQUEMENT celles de /omra (dates, durée, prix, hôtel, prestations) ---
const GROUP_FEATURES = ["تذكرة الطائرة ذهاباً وإياباً", "تأشيرة العمرة + التأمين الصحي", "فندق أرائك غزة ⭐⭐⭐ قريب من الحرم", "التنقلات بحافلات سياحية مريحة", "مرافقون ذوو خبرة + مرافقة نسائية", "هدايا للمعتمرين"]
function groupPreset(o: { name: string; slug: string; date: string; nights: string; nightsDetail: string; price: string; tag: string }): ThemePreset {
  return {
    name: o.name,
    slug: o.slug,
    headline: `${o.name.startsWith("عمرة") ? o.name : `عمرة ${o.name}`} — ${o.nights} ليلة (${o.nightsDetail})`,
    description: `رحلة عمرة مع Easy2Book: ${o.nights} ليلة (${o.nightsDetail})، طيران ذهاباً وإياباً، تأشيرة العمرة والتأمين الصحي، إقامة في فندق أرائك غزة ⭐⭐⭐ قريب من الحرم، تنقلات بحافلات سياحية مريحة، مرافقون ذوو خبرة ومرافقة نسائية، وهدايا للمعتمرين. عدد الأماكن محدود.`,
    offers: [{ name: o.name, destination: "مكة المكرمة والمدينة المنورة", nights_detail: o.nightsDetail, price: o.price, features: GROUP_FEATURES, departure_date: o.date, nights: o.nights, tag: o.tag }],
    design: {
      colors: { preset: "famille", custom: "#003878" },
      cta: { label: "احجز مكانك الآن", whatsapp: true },
      sections: [{ key: "intro", visible: true }, { key: "services", visible: true }, { key: "offers", visible: true }, { key: "conditions", visible: true }, { key: "inclusions", visible: false }, { key: "programme", visible: true }, { key: "testimonials", visible: false }, { key: "faq", visible: true }, { key: "form", visible: true }],
      services: [
        { title: "طيران وتأشيرة العمرة والتأمين", text: "نتكفّل بتذكرة الطائرة ذهاباً وإياباً وبتأشيرة العمرة والتأمين الصحي، لتنطلق رحلتك دون عناء إداري." },
        { title: "فندق أرائك غزة ⭐⭐⭐ قريب من الحرم", text: "إقامة مريحة قريبة من الحرم مع دخول مباشر لمكة لأداء العمرة." },
        { title: "مرافقون ذوو خبرة + مرافقة نسائية", text: "مرافقة ميدانية طيلة الرحلة، وزيارة المزارات في مكة والمدينة، مع تنقلات بحافلات سياحية مريحة." },
        { title: "هدايا للمعتمرين", text: "هدايا من Easy2Book لكل معتمر." },
      ],
      conditions: [
        { title: "عرض المجموعات", text: "لكل 10 أشخاص عمرة مجانية، وأسعار خاصة للعائلات والمجموعات. الاتصال على 98 140 514." },
        { title: "تنبيه التوفر", text: "عدد الأماكن محدود." },
      ],
      faq: [
        { q: "شنوة يشمل السعر؟", a: "الطيران ذهاباً وإياباً، تأشيرة العمرة والتأمين الصحي، الإقامة في فندق أرائك غزة ⭐⭐⭐ قريب من الحرم، التنقلات بالحافلات، زيارة المزارات، المرافقة (منها مرافقة نسائية) وهدايا للمعتمرين." },
        { q: "كيفاش نستفيد من عرض المجموعات؟", a: "لكل 10 أشخاص عمرة مجانية، وأسعار خاصة للعائلات والمجموعات. اختر عدد الأشخاص في الاستمارة أو احكي معانا على واتساب." },
        { q: "فما مرافقة للنساء؟", a: "نعم، المجموعة ترافقها مرافقة نسائية ذات خبرة إلى جانب المرافقين والمرشدين." },
      ],
    },
  }
}
const GROUP1_PRESET = groupPreset({ name: "الفوج الأول", slug: "omra-foj-1", date: "2027-01-27", nights: "14", nightsDetail: "10 بمكة + 4 بالمدينة", price: "5500", tag: "✈️ أول فوج" })
const GROUP2_PRESET = groupPreset({ name: "الفوج الثاني", slug: "omra-foj-2", date: "2027-02-18", nights: "25", nightsDetail: "20 بمكة + 5 بالمدينة", price: "7800", tag: "⭐ الإقامة الأطول" })
const CHAWWAL_PRESET = groupPreset({ name: "عمرة شوال", slug: "omra-chawwal", date: "2027-03-15", nights: "14", nightsDetail: "10 بمكة + 4 بالمدينة", price: "4800", tag: "🕌 السعر الأقل" })

const ALL_DATED: OfferField[] = ["name", "destination", "departure_date", "nights", "nights_detail", "price", "price_before", "seats_total", "tag", "features", "description", "image_url"]

export const THEMES: Theme[] = [
  { id: "omra", label: "Omra", tagline: "Départs de Omra avec dates, durée et places", emoji: "🕋", product: "omra", family: "omra", lang: "ar", offerRequired: ["departure_date", "nights"], offerFields: ALL_DATED,
    hints: { name: "ex. Omra — premier groupe", headline: "ex. Votre Omra, accompagnée du départ au retour", features: "ex. Vol aller-retour\nHébergement\nAccompagnement", description: "Décrivez le programme réel de ce départ." } },
  { id: "ramadan-omra", label: "Omra Ramadan", tagline: "Omra pendant le mois de Ramadan", emoji: "🌙", product: "omra", family: "omra", lang: "ar", offerRequired: ["departure_date", "nights"], offerFields: ALL_DATED,
    hints: { name: "ex. Omra Ramadan 2027 — départ 1", headline: "ex. Vivez Ramadan à La Mecque et Médine", features: "ex. Vol aller-retour\nHôtel près du Haram\nGuide religieux", description: "Décrivez le programme réel de ce départ." } },
  { id: "ramadan-complet", label: "Omra Ramadan complet", tagline: "Un mois complet à La Mecque : chambres à 2, 3 ou 4-5, services, conditions et témoignages", emoji: "🌙", product: "omra", family: "omra", lang: "ar", offerRequired: ["departure_date", "nights"], offerFields: ALL_DATED,
    hints: { name: "ex. غرفة ثنائية", headline: "ex. عمرة شهر رمضان كامل", features: "ex. طيران\nفندق ميسان الملتزم", description: "Programme réel de ce départ." }, preset: RAMADAN_PRESET },
  { id: "omra-groupe-1", label: "Omra — Groupe 1", tagline: "Départ du 27 janvier 2027 · 14 nuits · 5 500 TND", emoji: "✈️", product: "omra", family: "omra", lang: "ar", offerRequired: ["departure_date", "nights"], offerFields: ALL_DATED,
    hints: { name: "ex. الفوج الأول", headline: "ex. عمرة مع مرافقة كاملة", features: "ex. طيران\nفندق أرائك غزة", description: "Programme réel de ce départ." }, preset: GROUP1_PRESET },
  { id: "omra-groupe-2", label: "Omra — Groupe 2", tagline: "Départ du 18 février 2027 · 25 nuits · 7 800 TND", emoji: "⭐", product: "omra", family: "omra", lang: "ar", offerRequired: ["departure_date", "nights"], offerFields: ALL_DATED,
    hints: { name: "ex. الفوج الأول", headline: "ex. عمرة مع مرافقة كاملة", features: "ex. طيران\nفندق أرائك غزة", description: "Programme réel de ce départ." }, preset: GROUP2_PRESET },
  { id: "omra-chawwal", label: "Omra — Chawwal", tagline: "Départ du 15 mars 2027 · 14 nuits · 4 800 TND", emoji: "🕌", product: "omra", family: "omra", lang: "ar", offerRequired: ["departure_date", "nights"], offerFields: ALL_DATED,
    hints: { name: "ex. الفوج الأول", headline: "ex. عمرة مع مرافقة كاملة", features: "ex. طيران\nفندق أرائك غزة", description: "Programme réel de ce départ." }, preset: CHAWWAL_PRESET },
  { id: "voyage-organise", label: "Voyage organisé", tagline: "Voyage de groupe avec programme et dates de départ", emoji: "🧳", product: "voyage", family: "voyage", lang: "fr", offerRequired: ["destination", "departure_date"], offerFields: ALL_DATED,
    hints: { name: "ex. Voyage organisé — nom du circuit", headline: "ex. Un voyage organisé, sans souci", destination: "ex. destination", features: "ex. Vol\nHôtel\nTransferts", description: "Programme jour par jour (réel)." } },
  { id: "turquie", label: "Turquie", tagline: "Voyage organisé vers la Turquie", emoji: "🇹🇷", product: "voyage", family: "voyage", lang: "fr", offerRequired: ["departure_date"], offerFields: ALL_DATED,
    hints: { name: "ex. Turquie — nom du circuit", headline: "ex. Découvrez la Turquie avec Easy2Book", destination: "Turquie", features: "ex. Vol\nHôtel\nVisites", description: "Programme jour par jour (réel)." } },
  { id: "circuit", label: "Circuit touristique", tagline: "Circuit avec étapes et programme détaillé", emoji: "🗺️", product: "voyage", family: "voyage", lang: "fr", offerRequired: ["destination", "departure_date", "description"], offerFields: ALL_DATED,
    hints: { name: "ex. Circuit — nom", headline: "ex. Un circuit étape par étape", destination: "ex. régions visitées", features: "ex. Transport\nHébergement\nGuide", description: "Étapes du circuit (réelles)." } },
  { id: "hotel", label: "Hôtel", tagline: "Promotion ou offre pour un hôtel", emoji: "🏨", product: "hotel", family: "hotel", lang: "fr", offerRequired: ["destination"], offerFields: ["name", "destination", "price", "price_before", "seats_total", "tag", "features", "description", "image_url"],
    hints: { name: "ex. Nom de l'hôtel", headline: "ex. Votre séjour à prix réduit", destination: "ex. ville", features: "ex. Petit-déjeuner\nPiscine", description: "Précisez la base du prix (par personne, par nuit…)." } },
  { id: "sejour", label: "Séjour", tagline: "Séjour clé en main (hôtel, durée, formule)", emoji: "🏖️", product: "hotel", family: "hotel", lang: "fr", offerRequired: ["destination", "nights"], offerFields: ["name", "destination", "departure_date", "nights", "nights_detail", "price", "price_before", "seats_total", "tag", "features", "description", "image_url"],
    hints: { name: "ex. Séjour — nom", headline: "ex. Un séjour sans souci", destination: "ex. ville", features: "ex. Demi-pension\nAccès plage", description: "Détails réels du séjour." } },
  { id: "vacances", label: "Vacances d'été", tagline: "Offre vacances (voyage ou séjour) de saison", emoji: "☀️", product: "voyage", family: "voyage", lang: "fr", offerRequired: ["departure_date"], offerFields: ALL_DATED,
    hints: { name: "ex. Vacances — nom de l'offre", headline: "ex. Vos vacances d'été avec Easy2Book", destination: "ex. destination", features: "ex. Vol\nHôtel", description: "Détails réels de l'offre." } },
  { id: "promotion", label: "Promotion spéciale", tagline: "Offre promotionnelle avec prix barré", emoji: "🏷️", product: "autre", family: "autre", lang: "fr", offerRequired: ["price_before"], offerFields: ["name", "destination", "departure_date", "price", "price_before", "seats_total", "tag", "features", "description", "image_url"],
    hints: { name: "ex. Promotion — nom", headline: "ex. Une offre à saisir", features: "ex. Ce qui est inclus", description: "Conditions réelles de la promotion." } },
  { id: "autre", label: "Autre produit", tagline: "Tout autre produit ou service", emoji: "✨", product: "autre", family: "autre", lang: "fr", offerRequired: [], offerFields: ["name", "destination", "departure_date", "price", "price_before", "seats_total", "tag", "features", "description", "image_url"],
    hints: { name: "ex. Nom du produit", headline: "ex. Pourquoi ce produit", features: "ex. Point fort 1\nPoint fort 2", description: "Description réelle du produit." } },
]

export const themeById = (id: string | null | undefined): Theme | null => THEMES.find((t) => t.id === id) ?? null

/** Famille visuelle de la page publique d'après le produit de la catégorie (le thème n'est pas enregistré). */
export const familyOf = (product: string | null | undefined): Family => (product === "omra" || product === "voyage" || product === "hotel" ? product : "autre")

/** Libellés des champs d'une offre (français). */
export const OFFER_FIELD_LABELS: Record<OfferField, string> = {
  name: "Nom de l'offre", destination: "Destination", departure_date: "Date de départ", nights: "Nombre de nuits", nights_detail: "Détail des nuits", price: "Prix (TND)",
  price_before: "Prix barré avant remise (TND)", seats_total: "Places disponibles", tag: "Étiquette (ex. 1er groupe)", features: "Prestations incluses", description: "Programme / détails", image_url: "Photo",
}
