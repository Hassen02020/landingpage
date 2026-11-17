import { NextRequest, NextResponse } from "next/server"
import { flattenAttribution, obj, str } from "@/lib/server/attribution"
import { clientIp, normalizePhone, randomRef, sha256 } from "@/lib/server/hash"
import { isAllowedOrigin, rateLimited, rememberOnce } from "@/lib/server/guard"
import { sendMetaLogged } from "@/lib/server/conversions"
import { sendTikTokEvent } from "@/lib/server/tiktok"
import { DbError, currentOrgKey, dbConfigured, insertOne, select, withPublicOrg } from "@/lib/server/db"
import { CONSENT_TEXT_VERSION, PRODUCTS, isProduct, WHATSAPP_NUMBER, type Product } from "@/lib/config"
import { logActivity, tunisDay } from "@/lib/server/crm"
import { notifyNewLead } from "@/lib/server/notify"
import { verifyCaptcha } from "@/lib/server/captcha"
import { cleanEmail } from "@/lib/validation"
import { isRegion } from "@/lib/regions"
import { isAgeRange } from "@/lib/age-range"
import { checkLead } from "@/lib/server/protection"
import { waText } from "@/lib/wa-text"
import { discountLabel, findUsablePromo, normalizeCode, redeemPromo, type PromoRow } from "@/lib/server/promo"
import { applyFormConfig, type FormConfig } from "@/lib/form-config"

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000
// Limites de débit (en mémoire, par instance) : l'IP est large car des abonnés mobiles d'un même opérateur partagent une adresse publique ;
// le numéro de téléphone, lui, est propre à une personne : au plus 3 NOUVELLES demandes par 10 minutes (les doublons ne comptent pas).
export const IP_RATE_LIMIT = 20
export const PHONE_RATE_LIMIT = 3

// Entier borné, ou null si la valeur n'a pas été fournie : on n'invente JAMAIS une donnée (ex. « 1 adulte »).
const optInt = (v: unknown, min: number, max: number): number | null => {
  if (v === undefined || v === null || String(v).trim() === "") return null
  const n = typeof v === "number" ? v : parseInt(String(v), 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null
}


const cut = (v: string | undefined, max: number) => (v ? v.slice(0, max) : undefined)

// Chemin (sans paramètres) de la page du formulaire, d'après l'URL envoyée par le navigateur.
function formPage(pageUrl: string | undefined): string | null {
  if (!pageUrl) return null
  try {
    const path = new URL(pageUrl).pathname
    return /^\/[A-Za-z0-9\-_/.]*$/.test(path) ? path.slice(0, 255) : null
  } catch {
    return null
  }
}

// Retire les colonnes récentes d'une ligne que la base refuse. Retourne true si la ligne a changé.
function degradeRow(row: Record<string, unknown>, code: string | undefined): boolean {
  let changed = false
  if (code === "23503" || code === "PGRST204" || code === "42703") {
    for (const col of ["offer_id", "email", "region", "age_range", "contact_channel", "form_page", "custom_fields"]) {
      if (col in row) {
        delete row[col]
        changed = true
      }
    }
  }
  // ancienne base : voyageurs obligatoires (NOT NULL, avant 0006) → valeurs historiques
  if (code === "23502" && (row.adults === null || row.children === null)) {
    row.adults = row.adults ?? 1
    row.children = row.children ?? 0
    changed = true
  }
  return changed
}

/** Consigne une nouvelle demande dans l'historique du lead existant (jamais d'erreur : la réponse au visiteur prime). */
async function noteRepeatRequest(existing: { id?: string; ref: string }, summary: string): Promise<void> {
  try {
    let id = existing.id
    if (!id) {
      const rows = await select<{ id: string }>("landing_leads", `select=id&ref=eq.${encodeURIComponent(existing.ref)}&limit=1`)
      id = rows[0]?.id
    }
    if (id) await logActivity(id, { id: null, label: "système" }, "note", { body: summary })
  } catch {
    console.error("[leads] nouvelle demande du même numéro non consignée")
  }
}

/**
 * POST /api/leads — formulaire des landing pages.
 * 1. contrôles : origine, débit, champ piège, validation, accord de recontact
 * 2. anti-doublon (même téléphone + même produit en 10 min, ou même event_id)
 * 3. enregistrement dans la base Supabase DÉDIÉE aux landing pages (pas le CRM EasyV4) ;
 *    doublons bloqués aussi en base (idempotency_key, téléphone + produit + jour)
 * 4. événement "Lead" Meta / TikTok UNIQUEMENT si consentement traceurs = granted
 * Réponse : code de référence + lien WhatsApp pré-rempli.
 */
export interface IntakeContext {
  /** true : site public d'Easy2Book (numéro WhatsApp, notification d'équipe, produits historiques) ; false : page d'une entreprise cliente */
  platform: boolean
  /** identifiant public de l'entreprise (page /o/<identifiant>), pour la limitation de débit */
  orgSlug?: string
  /** configuration du formulaire de l'entreprise (page /o/<identifiant>) */
  formConfig?: FormConfig
}

export async function handleLeadPost(request: NextRequest, ctx: IntakeContext = { platform: true }) {
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
  if (rateLimited(ip && `lead:${ctx.orgSlug ?? "-"}:${ip}`, IP_RATE_LIMIT, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de demandes. Contactez-nous directement sur WhatsApp." }, { status: 429 })
  }

  const name = str(body.name, 200)
  const phone = normalizePhone(String(body.phone ?? ""))
  // entreprise cliente : pas de produit historique d'Easy2Book, ses offres sont du texte libre
  const product: Product = ctx.platform && isProduct(body.product) ? body.product : "autre"

  const errors: Record<string, string> = {}
  if (!name || name.length < 2) errors.name = "Nom requis"
  if (!phone) errors.phone = "Numéro invalide : 8 chiffres (ex. 98 140 514) ou format international (+33…)"
  if (body.contactConsent !== true) errors.contactConsent = "Merci d'accepter d'être recontacté au sujet de votre demande"
  // formulaire configuré par l'entreprise : champs obligatoires, champs désactivés ignorés, champs personnalisés
  const intake = ctx.formConfig ? applyFormConfig(ctx.formConfig, body) : null
  if (intake) Object.assign(errors, intake.errors)
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

  const offer = intake ? intake.accepted.offer : str(body.offer)
  const travelDate = str(body.travel_date, 10)
  const adults = optInt(body.adults, 1, 50)
  const children = optInt(body.children, 0, 20)
  const email = cleanEmail(intake ? intake.accepted.email : body.email)
  const [firstName, ...rest] = name!.split(/\s+/)

  const whatsappUrlFor = (leadRef: string): string | null => {
    if (!ctx.platform) return null // le numéro WhatsApp est celui d'Easy2Book : jamais proposé aux visiteurs d'une autre entreprise
    const whatsappText = [
    `Bonjour Easy2Book, je souhaite réserver : ${PRODUCTS[product]}${offer ? ` — ${offer}` : ""}`,
    `Nom : ${name}`,
    str(body.destination) ? `Destination : ${str(body.destination)}` : null,
    travelDate ? `Date : ${travelDate}` : str(body.travel_period, 64) ? `Période : ${str(body.travel_period, 64)}` : null,
    adults !== null ? `Voyageurs : ${adults} adulte(s)${children ? ` + ${children} enfant(s)` : ""}` : null,
    promo ? `Code promo : ${promo.code} (${discountLabel(promo)})` : null,
    "",
    `Réf: ${leadRef}`,
    ]
      .filter((l) => l !== null)
      .join("\n")
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waText(whatsappText))}`
  }

  // Anti-doublon : double clic (même event_id) ou nouvel envoi identique en 10 min
  const orgKey = (await currentOrgKey()) ?? "none"
  // Nouvelle demande du même numéro pour le même produit : elle n'ajoute pas de lead, mais ses précisions (offre, voyageurs,
  // région, annonce) sont consignées dans l'historique du lead existant au lieu d'être perdues.
  const repeatSummary = (): string =>
    [
      `Nouvelle demande du même numéro (${PRODUCTS[product]})`,
      offer ? `offre : ${offer}` : null,
      adults !== null ? `${adults} adulte(s)${children ? ` + ${children} enfant(s)` : ""}` : null,
      ctx.platform && isRegion(body.region) ? `région : ${body.region}` : null,
      attr.utm_campaign ? `campagne : ${attr.utm_campaign}` : null,
      attr.utm_content ? `annonce : ${attr.utm_content}` : null,
      attr.landing_page ? `page : ${attr.landing_page}` : null,
    ]
      .filter(Boolean)
      .join(" — ")
  const sameSubmission = rememberOnce(["event", orgKey, eventId], ref, DUPLICATE_WINDOW_MS)
  if (sameSubmission) {
    return NextResponse.json({ ok: true, duplicate: true, ref: sameSubmission, stored: false, whatsappUrl: whatsappUrlFor(sameSubmission) })
  }
  const repeatOf = rememberOnce(["lead", orgKey, phone!, product], ref, DUPLICATE_WINDOW_MS)
  if (repeatOf) {
    await noteRepeatRequest({ ref: repeatOf }, repeatSummary())
    return NextResponse.json({ ok: true, duplicate: true, ref: repeatOf, stored: false, whatsappUrl: whatsappUrlFor(repeatOf) })
  }
  // un même numéro ne peut pas multiplier les nouvelles demandes (autres produits, autres offres) : 3 par 10 minutes
  if (rateLimited(`leadphone:${orgKey}:${sha256(phone!)}`, PHONE_RATE_LIMIT, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de demandes. Contactez-nous directement sur WhatsApp." }, { status: 429 })
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
    destination: ctx.platform ? str(body.destination, 128) || null : null,
    travel_date: travelDate && /^\d{4}-\d{2}-\d{2}$/.test(travelDate) ? travelDate : null,
    travel_period: str(body.travel_period, 64) || null,
    adults, // null = non précisé (la fiche CRM le complète pendant la qualification)
    children,
    email,
    // région facultative (menu de la page) : acceptée seulement si elle figure dans la liste officielle des gouvernorats ; jamais pour une entreprise cliente ; toute autre valeur est ignorée
    ...(ctx.platform && isRegion(body.region) ? { region: body.region } : {}),
    // tranche d'âge DÉCLARÉE (facultative) : valeur de la liste seulement, jamais pour une entreprise cliente, jamais envoyée aux plateformes publicitaires
    ...(ctx.platform && isAgeRange(body.age_range) ? { age_range: body.age_range } : {}),
    contact_channel: "whatsapp",
    budget: (intake ? intake.accepted.budget : str(body.budget, 64)) || null,
    trip_type: str(body.trip_type, 64) || null,
    message: (intake ? intake.accepted.message : str(body.message, 1000)) || null,
    ...(intake?.custom ? { custom_fields: intake.custom } : {}),
    ...(promo ? { promo_code: normalizeCode(promo.code) } : {}),
    // offre du catalogue (colonne créée par 0004 ; envoyée seulement par les pages lues dans le catalogue)
    ...(typeof body.offer_id === "string" && /^[0-9a-f-]{36}$/i.test(body.offer_id) ? { offer_id: body.offer_id } : {}),
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
    landing_page: attr.landing_page ?? null, // page d'ARRIVÉE de la visite
    form_page: formPage(attr.page_url), // page où le formulaire a été ENVOYÉ (colonne ajoutée par 0006)
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
        // Base pas encore à jour (colonnes des migrations 0004 / 0006 absentes) ou offre inconnue :
        // on dégrade l'enregistrement plutôt que de PERDRE le lead (ordre conseillé : migration avant déploiement).
        if (e instanceof DbError && degradeRow(row, e.code)) {
          attempt--
          continue
        }
        if (!(e instanceof DbError && e.isUniqueViolation)) {
          // on ne bloque pas le prospect : il reste orienté vers WhatsApp
          console.error("[leads] enregistrement impossible", e instanceof Error ? e.message : "erreur")
          break
        }
        // vrai doublon (même envoi, ou même téléphone + produit le même jour) : on renvoie la référence existante
        let existing: { id?: string; ref: string; idempotency_key?: string }[] = []
        try {
          existing = await select<{ id?: string; ref: string; idempotency_key?: string }>(
            "landing_leads",
            `select=id,ref,idempotency_key&or=(idempotency_key.eq.${encodeURIComponent(eventId)},and(phone.eq.${phone},product.eq.${product},lead_day.eq.${tunisDay()}))&limit=1`
          )
        } catch {
          console.error("[leads] vérification de doublon impossible")
          break
        }
        if (existing[0]) {
          // même envoi rejoué : rien à ajouter ; autre demande du même numéro le même jour : consignée dans l'historique
          if (existing[0].idempotency_key !== eventId) await noteRepeatRequest(existing[0], repeatSummary())
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
  // la notification d'équipe part vers les canaux d'Easy2Book : jamais pour le lead d'une autre entreprise
  if (ctx.platform) tasks.push(
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
    tasks.push(sendMetaLogged(serverEvent, { leadId: stored ? leadId : null }), sendTikTokEvent(serverEvent))
  }

  await Promise.allSettled(tasks)
  return NextResponse.json({ ok: true, ref, stored, whatsappUrl: whatsappUrlFor(ref) })
}

