import { NextRequest, NextResponse } from "next/server"
import { flattenAttribution, obj, str } from "@/lib/server/attribution"
import { clientIp, normalizePhone, randomRef } from "@/lib/server/hash"
import { isAllowedOrigin, rateLimited, rememberOnce } from "@/lib/server/guard"
import { sendMetaEvent } from "@/lib/server/meta"
import { sendTikTokEvent } from "@/lib/server/tiktok"
import { forwardLeadToCrm, type EasyV4LeadInput } from "@/lib/server/crm"
import { PRODUCTS, isProduct, WHATSAPP_NUMBER, type Product } from "@/lib/config"

export const runtime = "nodejs"

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000

// Produits des landing pages → `leads.product_type` d'EasyV4 (contrainte leads_product_type_check)
const PRODUCT_TO_EASYV4: Record<Product, EasyV4LeadInput["productType"]> = {
  omra: "omra",
  voyage: "package",
  hotel: "hotel",
  autre: "general",
}

const int = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

const cut = (v: string | undefined, max: number) => (v ? v.slice(0, max) : undefined)

/**
 * POST /api/leads — formulaire des landing pages.
 * 1. contrôles : origine, débit, champ piège, validation, accord de recontact
 * 2. anti-doublon (même téléphone + même produit en 10 min, ou même event_id)
 * 3. transmission au CRM EasyV4 (aucun stockage local)
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

  const attr = flattenAttribution(body.attribution)
  const trackingConsent = body.trackingConsent === true
  const marketingConsent = body.marketingConsent === true
  const rawEventId = str(body.eventId, 64)
  const eventId = rawEventId && /^[A-Za-z0-9-]{8,64}$/.test(rawEventId) ? rawEventId : crypto.randomUUID()
  const ref = attr.ref || randomRef()

  const offer = str(body.offer)
  const travelDate = str(body.travel_date, 10)
  const adults = int(body.adults, 1, 50, 1)
  const children = int(body.children, 0, 20, 0)
  const [firstName, ...rest] = name!.split(/\s+/)

  const whatsappText = [
    `Bonjour Easy2Book 👋 je souhaite réserver : ${PRODUCTS[product]}${offer ? ` — ${offer}` : ""}`,
    `Nom : ${name}`,
    str(body.destination) ? `Destination : ${str(body.destination)}` : null,
    travelDate ? `Date : ${travelDate}` : str(body.travel_period, 64) ? `Période : ${str(body.travel_period, 64)}` : null,
    `Voyageurs : ${adults} adulte(s)${children ? ` + ${children} enfant(s)` : ""}`,
    "",
    `Réf: ${ref}`,
  ]
    .filter((l) => l !== null)
    .join("\n")
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappText)}`

  // Anti-doublon : double clic (même event_id) ou nouvel envoi identique en 10 min
  const already =
    rememberOnce(["event", eventId], ref, DUPLICATE_WINDOW_MS) ??
    rememberOnce(["lead", phone!, product], ref, DUPLICATE_WINDOW_MS)
  if (already) {
    return NextResponse.json({ ok: true, duplicate: true, ref: already, forwarded: false, whatsappUrl })
  }

  // Détails sans colonne dédiée dans EasyV4 : regroupés dans `message` (saisis par le visiteur)
  const details = [
    travelDate ? `Date souhaitée : ${travelDate}` : null,
    str(body.travel_period, 64) ? `Période : ${str(body.travel_period, 64)}` : null,
    `Voyageurs : ${adults} adulte(s), ${children} enfant(s)`,
    str(body.budget, 64) ? `Budget : ${str(body.budget, 64)}` : null,
    str(body.trip_type, 64) ? `Type : ${str(body.trip_type, 64)}` : null,
    str(body.message, 1000) ? `Message : ${str(body.message, 1000)}` : null,
    `Réf landing : ${ref}`,
  ]
    .filter(Boolean)
    .join("\n")

  const sourcePath = (attr.landing_page && attr.landing_page.startsWith("/") ? attr.landing_page : "/").split("?")[0]
  const crmInput: EasyV4LeadInput = {
    firstName: cut(firstName, 100)!,
    lastName: cut(rest.join(" "), 100) || undefined,
    phone: `+${phone}`,
    message: cut(details, 2000),
    productType: PRODUCT_TO_EASYV4[product],
    productLabel: cut(offer, 255),
    sourcePage: cut(`landing-easy2book${sourcePath}`, 255)!,
    destination: cut(str(body.destination), 128),
    intention: adults + children >= 10 ? "groupe" : "standard",
    campaignRef: cut(attr.utm_campaign, 255),
    marketingConsent,
  }

  const tasks: Promise<unknown>[] = [forwardLeadToCrm(crmInput, eventId)]

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

  const [crm] = await Promise.allSettled(tasks)
  const forwarded = crm.status === "fulfilled" && (crm.value as { ok: boolean }).ok
  if (!forwarded) console.warn("[leads] lead non transmis au CRM", { ref, product })

  return NextResponse.json({ ok: true, ref, forwarded, whatsappUrl })
}
