import type { Metadata } from "next"
import Script from "next/script"
import "./globals.css"

export const metadata: Metadata = {
  title: "Summer Vibes Tunisia 2026 — Easy2Book",
  description:
    "Réservez votre hôtel à Hammamet, Sousse ou Djerba au meilleur prix garanti. Enfant gratuit, Early Booking, Aquapark, Voyage de Noces — Easy2Book, votre centrale de réservation.",
  openGraph: {
    title: "Summer Vibes Tunisia 2026 — Easy2Book",
    description: "Les meilleures offres hôtelières en Tunisie pour l'été 2026.",
    type: "website",
    url: "https://landingpage-puce-five.vercel.app/summer-vibes",
    siteName: "Easy2Book",
    images: [
      {
        url: "https://landingpage-puce-five.vercel.app/logo.jpg",
        width: 1200,
        height: 630,
        alt: "Easy2Book Summer Vibes 2026",
      },
    ],
  },
  other: {
    "fb:page_id": "Easy2Bookplateforme",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="antialiased">
        {/* Meta Pixel */}
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '1674012850599992');
              fbq('track', 'PageView');
            `,
          }}
        />
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1674012850599992&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {children}
      </body>
    </html>
  )
}
