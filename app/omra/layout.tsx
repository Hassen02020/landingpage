import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "عمرة العطلة الصيفية 2026 — Easy2Book 🕋",
  description:
    "رحلة عمرة 14 يوم بسعر 4100 د.ت فقط — فندق أرائك غزة ⭐⭐⭐ — تأشيرة + تأمين + طيران — فوج جوان وجويلية 2026. احجز مكانك الآن مع Easy2Book!",
  openGraph: {
    title: "عمرة الصيف 2026 — 4100 د.ت 🕋 Easy2Book",
    description:
      "✅ فندق قريب من الحرم ✅ تأشيرة + تأمين ✅ طيران ✅ مرافقة نسائية ✅ هدايا للمعتمرين — الفوج الأول 28 جوان | الفوج الثاني 28 جويلية",
    type: "website",
    url: "https://landingpage-easy2book.vercel.app/omra",
    siteName: "Easy2Book",
    images: [
      {
        url: "https://landingpage-easy2book.vercel.app/logo.jpg",
        width: 1200,
        height: 630,
        alt: "Easy2Book عمرة الصيف 2026",
      },
    ],
    locale: "ar_TN",
  },
  twitter: {
    card: "summary_large_image",
    title: "عمرة الصيف 2026 — 4100 د.ت 🕋",
    description: "احجز رحلة عمرتك الصيفية مع Easy2Book — 14 يوم بسعر 4100 د.ت فقط",
    images: ["https://landingpage-easy2book.vercel.app/logo.jpg"],
  },
  other: {
    "fb:page_id": "Easy2Bookplateforme",
  },
}

export default function OmraLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
