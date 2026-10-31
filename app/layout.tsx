import type { Metadata } from "next"
import Script from "next/script"
import "./globals.css"
import { AttributionTracker } from "./components/AttributionTracker"
import { META_PIXEL_ID, SITE_URL, TIKTOK_PIXEL_ID } from "@/lib/config"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Easy2Book — Voyages organisés, Omra & Promos hôtels",
  description:
    "Easy2Book, votre agence de voyage en Tunisie : voyages organisés (Turquie, Égypte, Bali…), Omra et promos hôtels en Tunisie. Réservation rapide sur WhatsApp.",
  openGraph: {
    title: "Easy2Book — Voyages organisés, Omra & Promos hôtels",
    description: "Voyages organisés, Omra et meilleures offres hôtelières en Tunisie. Réservez sur WhatsApp.",
    type: "website",
    url: SITE_URL,
    siteName: "Easy2Book",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Easy2Book",
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
              fbq('init', '${META_PIXEL_ID}');
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
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>

        {/* TikTok Pixel — activé dès que NEXT_PUBLIC_TIKTOK_PIXEL_ID est défini */}
        {TIKTOK_PIXEL_ID && (
          <Script
            id="tiktok-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                !function (w, d, t) {
                  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
                  ttq.load('${TIKTOK_PIXEL_ID}');
                  ttq.page();
                }(window, document, 'ttq');
              `,
            }}
          />
        )}

        <AttributionTracker />
        {children}
      </body>
    </html>
  )
}
