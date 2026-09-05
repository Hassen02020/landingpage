import type { Metadata } from "next"
import { Inter, Sora } from "next/font/google"
import "./globals.css"
import { MarketingScripts } from "@/components/analytics/MarketingScripts"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://petora.com"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "PETORA — Better Care. Happier Pets.",
    template: "%s | PETORA",
  },
  description:
    "Premium dog and cat food, treats, and everyday essentials for the pets you love. Shop best sellers, subscribe & save with Autoship, and get free shipping on your first order.",
  openGraph: {
    type: "website",
    siteName: "PETORA",
    title: "PETORA — Better Care. Happier Pets.",
    description: "Premium food, treats and everyday essentials for the pets you love.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "PETORA — Better Care. Happier Pets.",
    description: "Premium food, treats and everyday essentials for the pets you love.",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        {children}
        <MarketingScripts />
      </body>
    </html>
  )
}
