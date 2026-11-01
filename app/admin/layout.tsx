import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Espace équipe — Easy2Book",
  robots: { index: false, follow: false },
}

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">{children}</div>
}
