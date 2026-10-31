import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "عمرة العطلة الصيفية 2026 — Easy2Book 🕋",
  description:
    "رحلة عمرة 14 يوم بسعر 4800 د.ت — فندق أرائك غزة ⭐⭐⭐ — تأشيرة + تأمين + طيران — أفواج جويلية وأوت 2026 + عمرة المولد النبوي. احجز مكانك الآن مع Easy2Book!",
  openGraph: {
    title: "عمرة الصيف 2026 — 4800 د.ت 🕋 Easy2Book",
    description:
      "✅ فندق قريب من الحرم ✅ تأشيرة + تأمين ✅ طيران ✅ مرافقة نسائية ✅ هدايا للمعتمرين — الأفواج: 15 جويلية | 28 جويلية | 20 أوت (المولد النبوي)",
    type: "website",
    url: "https://landingpage-easy2book.vercel.app/omra",
    siteName: "Easy2Book",
    images: [
      {
        url: "https://landingpage-easy2book.vercel.app/logo.png",
        width: 1200,
        height: 630,
        alt: "Easy2Book عمرة الصيف 2026",
      },
    ],
    locale: "ar_TN",
  },
  twitter: {
    card: "summary_large_image",
    title: "عمرة الصيف 2026 — 4800 د.ت 🕋",
    description: "احجز رحلة عمرتك الصيفية مع Easy2Book — 14 يوم بسعر 4800 د.ت",
    images: ["https://landingpage-easy2book.vercel.app/logo.png"],
  },
  other: {
    "fb:page_id": "Easy2Bookplateforme",
  },
}

export default function OmraLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
