// Contenu de la page « Omra à la carte » (/omra-sur-mesure). Source UNIQUE : la brochure « Easy2Book Omra sur mesure » fournie par le propriétaire.
// Aucun prix, aucune date de départ, aucun taux : la page est « sur devis » (le devis arrive sur WhatsApp). Les dates et le nombre de voyageurs
// qui figurent dans la maquette du PDF sont des valeurs par défaut d'un formulaire de démonstration, pas des offres : elles ne sont pas reprises.
import { defaultDesign, type DesignBlock, type PageDesign } from "@/lib/page-builder/design"
import type { Category } from "@/lib/server/catalog"

export const SLUG = "omra-sur-mesure"
export const VIDEO = "/omra-sur-mesure.mp4"
export const POSTER = "/omra-sur-mesure-poster.jpg"

export const CATEGORY: Category = {
  id: "static-omra-sur-mesure",
  slug: SLUG,
  name: "عمرتك على كيفك",
  product: "omra",
  lang: "ar",
  headline: "يزّي ما يفرضوا عليك وقتاش تمشي ووين تسكن… اليوم مع Easy2Book، عمرتك تفضّلها على كيفك!",
  description: "في 3 خطوات برك من تليفونك: اختار برنامج الطيران إلي يناسب ظروفك، احجز غرفتك في فنادق مكة مسبقاً بالدينار التونسي، واختار إقامتك في المدينة المنورة حسب المتاح.",
  banner_desktop: null,
  banner_mobile: null,
  seo_title: "عمرة على كيفك بدون برامج مفروضة — Easy2Book 🕋",
  seo_description: "اختار برنامج الطيران وفندقك في مكة والمدينة بنفسك. حجز مسبق ومضمون بالدينار التونسي، وعرض السعر يوصلك على واتساب. Easy2Book 98 140 514.",
  visible: true,
  position: 0,
  updated_at: "2026-11-25T00:00:00.000Z",
}

const block = (id: string, type: DesignBlock["type"], title: string, over: Partial<DesignBlock> = {}): DesignBlock => ({
  id, type, title, text: "", items: [], images: [], cta: "form", ctaLabel: "", video: "", ...over,
})

export const MAKKAH_HOTELS = [
  { title: "5★ مطل على الحرم (0–150م)", text: "إطلالة مباشرة وراحة قصوى للصلوات." },
  { title: "5★ قريب من الساحة (200–450م)", text: "مشي بضع دقائق إلى المسجد الحرام." },
  { title: "4★ مريح مع نقل مجاني 24/24", text: "توازن مثالي بين الراحة والسعر بالدينار." },
  { title: "3★ اقتصادي ومنظّم", text: "إقامة نظيفة ومضمونة بالدينار التونسي." },
]

export const MEDINA_HOTELS = [
  { title: "5★ المنطقة المركزية الشمالية", text: "خطوات من أبواب المسجد النبوي الشريف." },
  { title: "4★ قريب من المسجد النبوي", text: "إقامة هادئة للعائلات والأزواج." },
  { title: "3★ مرن حسب المتاح", text: "خيار عملي حسب التواريخ." },
]

export const SERVICES = [
  { title: "اختار برنامج طيرانك", text: "الانطلاق من تونس، المنستير، جربة أو صفاقس، بالتاريخ والوقت إلي يساعدك." },
  { title: "غرفتك في فنادق مكة بحجز مسبق بالدينار التونسي", text: "اختار فندقك قبل السفر (إطلالة الحرم أو فئة 4★/5★) مع خلاص 100% بالدينار التونسي." },
  { title: "إقامتك في المدينة حسب المتاح وبكل مرونة", text: "فنادق مختارة قرب المسجد النبوي الشريف، مع إمكانية إضافة التأشيرة والتنقلات." },
]

export const FAQ = [
  { q: "كيفاش نحصل على عرض السعر؟", a: "عمر الطلب في الصفحة أو ابعث برنامجك على واتساب 98 140 514، ويوصلك عرض السعر بالدينار التونسي." },
  { q: "نختار الفندق بنفسي؟", a: "إيه. في مكة تختار بين فئات 5★ و4★ و3★ حسب القرب من الحرم، وفي المدينة المنورة حسب المتاح." },
  { q: "بأي عملة نخلص؟", a: "الحجز مسبق ومضمون، والخلاص بالدينار التونسي." },
]

export const DESIGN: PageDesign = (() => {
  const d = defaultDesign("omra")
  d.hero = "split"
  d.cta = { label: "استلم عرض السعر", whatsapp: true }
  d.price = { prefix: false, showBefore: false }
  d.form = { ...d.form, email: true, region: true, age: false, destinations: [] }
  d.services = SERVICES
  d.faq = FAQ
  d.blocks = [
    block("video", "video", "عمرتك على كيفك", { video: VIDEO, images: [POSTER] }),
    block("makkah", "benefits", "غرفتك في فنادق مكة المكرمة (حجز مسبق بالدينار التونسي)", { items: MAKKAH_HOTELS }),
    block("medina", "benefits", "إقامتك في المدينة المنورة (حسب المتاح وبكل مرونة)", { items: MEDINA_HOTELS }),
    block("options", "notice", "حجز مسبق ومضمون · الخلاص بالدينار التونسي", { text: "اختيارياً: إدراج فيزا العمرة والتأمين، والتنقلات أو قطار الحرمين." }),
  ]
  d.sections = [
    { key: "services", visible: true },
    { key: "block:makkah", visible: true },
    { key: "block:medina", visible: true },
    { key: "block:options", visible: true },
    { key: "faq", visible: true },
    { key: "form", visible: true },
  ]
  return d
})()
