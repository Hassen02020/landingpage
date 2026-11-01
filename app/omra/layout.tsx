import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "عمرة رمضان 2027 + عمرة شوال — Easy2Book 🕋",
  description:
    "رحلة عمرة 14 يوم بسعر 4800 د.ت — فندق أرائك غزة ⭐⭐⭐ — تأشيرة + تأمين + طيران — أفواج 27 جانفي و18 فيفري و5 مارس 2027. احجز مكانك الآن مع Easy2Book!",
  openGraph: {
    title: "عمرة رمضان 2027 — 4800 د.ت 🕋 Easy2Book",
    description:
      "✅ فندق قريب من الحرم ✅ تأشيرة + تأمين ✅ طيران ✅ مرافقة نسائية ✅ هدايا للمعتمرين — الأفواج: 27 جانفي | 18 فيفري | 5 مارس 2027",
    type: "website",
    url: "https://landingpage-easy2book.vercel.app/omra",
    siteName: "Easy2Book",
    images: [
      {
        url: "https://landingpage-easy2book.vercel.app/logo.png",
        width: 1200,
        height: 630,
        alt: "Easy2Book عمرة رمضان 2027",
      },
    ],
    locale: "ar_TN",
  },
  twitter: {
    card: "summary_large_image",
    title: "عمرة رمضان 2027 — 4800 د.ت 🕋",
    description: "احجز رحلة عمرتك في رمضان 2027 مع Easy2Book — 14 يوم بسعر 4800 د.ت",
    images: ["https://landingpage-easy2book.vercel.app/logo.png"],
  },
  other: {
    "fb:page_id": "Easy2Bookplateforme",
  },
}

export default function OmraLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
