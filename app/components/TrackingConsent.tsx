"use client"

import { useEffect, useState } from "react"
import Script from "next/script"
import { usePathname } from "next/navigation"
import { CONSENT_EVENT, getConsent, setConsent, type ConsentState } from "@/lib/consent"
import { captureAttribution } from "@/lib/attribution"
import { META_PIXEL_ID, TIKTOK_PIXEL_ID } from "@/lib/config"

/**
 * Bandeau de consentement + chargement conditionnel des pixels.
 * Les scripts Meta et TikTok ne sont injectés qu'après « Accepter ».
 */
export function TrackingConsent() {
  const [consent, setState] = useState<ConsentState | null>(null)
  const [ready, setReady] = useState(false)
  const pathname = usePathname()
  const isArabic = pathname?.startsWith("/omra")

  useEffect(() => {
    setState(getConsent())
    setReady(true)
    const onChange = (e: Event) => setState((e as CustomEvent<ConsentState>).detail)
    window.addEventListener(CONSENT_EVENT, onChange)
    return () => window.removeEventListener(CONSENT_EVENT, onChange)
  }, [])

  const choose = (state: ConsentState) => {
    setConsent(state)
    if (state === "granted") {
      try {
        captureAttribution()
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <>
      {consent === "granted" && (
        <>
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
        </>
      )}

      {ready && consent === null && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Consentement cookies"
          dir={isArabic ? "rtl" : "ltr"}
          className="fixed inset-x-0 bottom-0 z-[60] bg-gray-950/95 text-white px-4 py-4 shadow-2xl"
        >
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 sm:items-center">
            <p className="text-sm leading-relaxed flex-1">
              {isArabic
                ? "نستعمل ملفات تعريف الارتباط الخاصة بـ Meta و TikTok لقياس أداء إعلاناتنا. لا يتم تفعيلها إلا بموافقتك."
                : "Nous utilisons des traceurs Meta et TikTok pour mesurer l'efficacité de nos publicités. Ils ne sont activés qu'avec votre accord."}
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => choose("denied")}
                className="px-4 py-2 rounded-xl border border-white/40 text-sm font-bold hover:bg-white/10"
              >
                {isArabic ? "رفض" : "Refuser"}
              </button>
              <button
                type="button"
                onClick={() => choose("granted")}
                className="px-4 py-2 rounded-xl bg-green-500 hover:bg-green-400 text-sm font-bold"
              >
                {isArabic ? "قبول" : "Accepter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
