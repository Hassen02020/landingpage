import { NextRequest, NextResponse } from "next/server"
import { flattenAttribution, obj, str } from "@/lib/server/attribution"
import { clientIp, normalizePhone, randomRef } from "@/lib/server/hash"
import { isAllowedOrigin, rateLimited, rememberOnce } from "@/lib/server/guard"
import { sendMetaEvent } from "@/lib/server/meta"
import { sendTikTokEvent } from "@/lib/server/tiktok"
import { DbError, dbConfigured, insertOne, select } from "@/lib/server/db"
import { CONSENT_TEXT_VERSION, PRODUCTS, isProduct, WHATSAPP_NUMBER, type Product } from "@/lib/config"
import { logActivity, tunisDay } from "@/lib/server/crm"
import { notifyNewLead } from "@/lib/server/notify"
import { verifyCaptcha } from "@/lib/server/captcha"
import { checkLead } from "@/lib/server/protection"
import { discountLabel, findUsablePromo, normalizeCode, redeemPromo, type PromoRow } from "@/lib/server/promo"

export const runtime = "nodejs"

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000

const int = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

const cut = (v: string | undefined, max: number) => (v ? v.slice(0, max) : undefined)

/**
 * POST /api/leads — formulaire des landing pages.
 * 1. contrôles : origine, débit, champ piège, validation, accord de recontact
 * 2. anti-doublon (même téléphone + même produit en 10 min, ou même event_id)
 * 3. enregistrement dans la base Supabase DÉDIÉE aux landing pages (pas le CRM EasyV4) ;
 *    doublons bloqués aussi en base (idempotency_key, téléphone + produit + jour)
 * 4. événement "Lead" Meta / TikTok UNIQUEMENT si consentement traceurs = granted
 * Réponse : code de référence + lien WhatsApp pré-rempli.
 */
export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request.headers)) {
    return NextResponse.json({ error: "Origine non autorisée" }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = obj(await request.json())
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }

  // Champ piège invisible : rempli uniquement par les robots (aucun signal renvoyé)
  if (str(body.website)) return NextResponse.json({ ok: true, ref: randomRef() })

  const ip = clientIp(request.headers)
  if (rateLimited(ip && `lead:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de demandes. Contactez-nous directement sur WhatsApp." }, { status: 429 })
  }

  const name = str(body.name, 200)
  const phone = normalizePhone(String(body.phone ?? ""))
  const product: Product = isProduct(body.product) ? body.product : "autre"

  const errors: Record<string, string> = {}
  if (!name || name.length < 2) errors.name = "Nom requis"
  if (!phone) errors.phone = "Numéro invalide : 8 chiffres (ex. 98 140 514) ou format international (+33…)"
  if (body.contactConsent !== true) errors.contactConsent = "Merci d'accepter d'être recontacté au sujet de votre demande"
  if (Object.keys(errors).length) return NextResponse.json({ error: "Formulaire incomplet", errors }, { status: 422 })

  // Captcha (si configuré) : vérifié côté serveur auprès de Cloudflare
  if (!(await verifyCaptcha(str(body.captchaToken, 2048), ip))) {
    return NextResponse.json({ error: "Vérification anti-robot échouée. Réessayez ou écrivez-nous sur WhatsApp." }, { status: 403 })
  }

  // Protection (/admin/protection) : numéro ou IP bloqués, pays non autorisé → refus sans détail
  const protection = await checkLead({ phone, ip, country: request.headers.get("x-vercel-ip-country") })
  if (protection.blocked) {
    console.warn("[leads] refusé par la protection", protection.reason)
    return NextResponse.json({ error: "Demande refusée. Contactez-nous directement par téléphone." }, { status: 403 })
  }

  // Code promo (facultatif) : vérifié ici, consommé seulement si le lead est enregistré
  const promoInput = str(body.promo_code, 64)
  let promo: PromoRow | null = null
  if (promoInput) {
    promo = dbConfigured() ? await findUsablePromo(promoInput, product).catch(() => null) : null
    if (!promo) {
      return NextResponse.json({ error: "Code promo invalide ou expiré", errors: { promo_code: "Code promo invalide ou expiré." } }, { status: 422 })
    }
  }

  const attr = flattenAttribution(body.attribution)
  const trackingConsent = body.trackingConsent === true
  const marketingConsent = body.marketingConsent === true
  const rawEventId = str(body.eventId, 64)
  const eventId = rawEventId && /^[A-Za-z0-9-]{8,64}$/.test(rawEventId) ? rawEventId : crypto.randomUUID()
  // Référence du lead : TOUJOURS générée par le serveur (unique en base).
  // Le code visiteur du navigateur (attr.ref) est conservé à part, dans visitor_ref.
  let ref = randomRef()

  const offer = str(body.offer)
  const travelDate = str(body.travel_date, 10)
  const adults = int(body.adults, 1, 50, 1)
  const children = int(body.children, 0, 20, 0)
  const [firstName, ...rest] = name!.split(/\s+/)

  const whatsappUrlFor = (leadRef: string) => {
    const whatsappText = [
    `Bonjour Easy2Book 👋 je souhaite réserver : ${PRODUCTS[product]}${offer ? ` — ${offer}` : ""}`,
    `Nom : ${name}`,
    str(body.destination) ? `Destination : ${str(body.destination)}` : null,
    travelDate ? `Date : ${travelDate}` : str(body.travel_period, 64) ? `Période : ${str(body.travel_period, 64)}` : null,
    `Voyageurs : ${adults} adulte(s)${children ? ` + ${children} enfant(s)` : ""}`,
    promo ? `Code promo : ${promo.code} (${discountLabel(promo)})` : null,
    "",
    `Réf: ${leadRef}`,
    ]
      .filter((l) => l !== null)
      .join("\n")
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappText)}`
  }

  // Anti-doublon : double clic (même event_id) ou nouvel envoi identique en 10 min
  const already =
    rememberOnce(["event", eventId], ref, DUPLICATE_WINDOW_MS) ??
    rememberOnce(["lead", phone!, product], ref, DUPLICATE_WINDOW_MS)
  if (already) {
    return NextResponse.json({ ok: true, duplicate: true, ref: already, stored: false, whatsappUrl: whatsappUrlFor(already) })
  }

  const row: Record<string, unknown> = {
    ref,
    visitor_ref: attr.ref ?? null,
    idempotency_key: eventId,
    first_name: cut(firstName, 100),
    last_name: cut(rest.join(" "), 100) || null,
    phone,
    product,
    offer: cut(offer, 255) || null,
    niche: str(body.niche, 64) || null,
    destination: str(body.destination, 128) || null,
    travel_date: travelDate && /^\d{4}-\d{2}-\d{2}$/.test(travelDate) ? travelDate : null,
    travel_period: str(body.travel_period, 64) || null,
    adults,
    children,
    budget: str(body.budget, 64) || null,
    trip_type: str(body.trip_type, 64) || null,
    message: str(body.message, 1000) || null,
    ...(promo ? { promo_code: normalizeCode(promo.code) } : {}),
    contact_consent: true,
    consent_text_version: CONSENT_TEXT_VERSION,
    marketing_consent: marketingConsent,
    tracking_consent: trackingConsent,
    // données de campagne (sans identifiant personnel)
    channel: attr.channel ?? null,
    utm_source: attr.utm_source ?? null,
    utm_medium: attr.utm_medium ?? null,
    utm_campaign: attr.utm_campaign ?? null,
    utm_content: attr.utm_content ?? null,
    utm_term: attr.utm_term ?? null,
    campaign_id: attr.campaign_id ?? null,
    adset_id: attr.adset_id ?? null,
    ad_id: attr.ad_id ?? null,
    first_channel: attr.first_channel ?? null,
    first_utm_source: attr.first_utm_source ?? null,
    first_utm_campaign: attr.first_utm_campaign ?? null,
    landing_page: attr.landing_page ?? null,
    // identifiants publicitaires : uniquement avec consentement (contrainte en base)
    ...(trackingConsent
      ? {
          visitor_id: attr.visitor_id ?? null,
          fbclid: attr.fbclid ?? null,
          ttclid: attr.ttclid ?? null,
          fbp: attr.fbp ?? null,
          fbc: attr.fbc ?? null,
          ttp: attr.ttp ?? null,
          ip: ip ?? null,
          user_agent: cut(request.headers.get("user-agent") || undefined, 500) ?? null,
        }
      : {}),
  }

  let stored = false
  let leadId: string | null = null
  if (dbConfigured()) {
    // jusqu'à 3 essais : une collision de référence aléatoire est rejouée avec une nouvelle référence
    for (let attempt = 0; attempt < 3 && !stored; attempt++) {
      try {
        const saved = await insertOne<{ id: string }>("landing_leads", { ...row, ref })
        leadId = saved?.id ?? null
        stored = true
      } catch (e) {
        if (!(e instanceof DbError && e.isUniqueViolation)) {
          // on ne bloque pas le prospect : il reste orienté vers WhatsApp
          console.error("[leads] enregistrement impossible", e instanceof Error ? e.message : "erreur")
          break
        }
        // vrai doublon (même envoi, ou même téléphone + produit le même jour) : on renvoie la référence existante
        let existing: { ref: string }[] = []
        try {
          existing = await select<{ ref: string }>(
            "landing_leads",
            `select=ref&or=(idempotency_key.eq.${encodeURIComponent(eventId)},and(phone.eq.${phone},product.eq.${product},lead_day.eq.${tunisDay()}))&limit=1`
          )
        } catch {
          console.error("[leads] vérification de doublon impossible")
          break
        }
        if (existing[0]) {
          return NextResponse.json({ ok: true, duplicate: true, ref: existing[0].ref, stored: true, whatsappUrl: whatsappUrlFor(existing[0].ref) })
        }
        ref = randomRef() // sinon : collision sur la référence aléatoire, nouvel essai
      }
    }
  } else {
    console.warn("[leads] base des landing pages non configurée — lead non enregistré", { ref, product })
  }

  const tasks: Promise<unknown>[] = []
  if (stored && leadId && promo) {
    tasks.push(redeemPromo(promo.code, product).catch(() => console.error("[leads] utilisation du code promo non comptée")))
  }
  if (stored && leadId) {
    tasks.push(
      logActivity(leadId, { id: null, label: "système" }, "created", {
        body: `Formulaire ${attr.landing_page || "/"} — consentement v${CONSENT_TEXT_VERSION}${marketingConsent ? ", marketing accepté" : ""}`,
      }).catch((e) => console.error("[leads] historique non écrit", e instanceof Error ? e.message : "erreur"))
    )
  }
  // l'équipe est prévenue même si la base est indisponible (le lead n'est alors pas perdu)
  tasks.push(
    notifyNewLead({
      id: leadId,
      ref,
      product,
      offer,
      firstName: firstName,
      phone: phone!,
      source: stored ? "formulaire" : "formulaire (NON ENREGISTRÉ en base)",
      channel: attr.channel,
      utmCampaign: attr.utm_campaign,
    })
  )
  if (trackingConsent) {
    const serverEvent = {
      eventName: "Lead",
      eventId, // même event_id que le pixel navigateur → déduplication Meta / TikTok
      pageUrl: attr.page_url,
      referrer: attr.referrer,
      customData: {
        product,
        content_category: product,
        content_name: offer || PRODUCTS[product],
        content_ids: offer || product,
        currency: "TND",
        value: 1,
      },
      user: {
        visitorId: attr.visitor_id,
        phone: phone!,
        firstName,
        lastName: rest.join(" ") || undefined,
        ip,
        userAgent: request.headers.get("user-agent") || undefined,
        fbp: attr.fbp,
        fbc: attr.fbc,
        ttp: attr.ttp,
        ttclid: attr.ttclid,
      },
    }
    tasks.push(sendMetaEvent(serverEvent), sendTikTokEvent(serverEvent))
  }

  await Promise.allSettled(tasks)
  return NextResponse.json({ ok: true, ref, stored, whatsappUrl: whatsappUrlFor(ref) })
}
