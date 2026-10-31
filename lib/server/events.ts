// Seuls ces événements peuvent être relayés vers Meta / TikTok (pas d'événement arbitraire).
// "Lead" et "Purchase" sont exclus : Lead part de /api/leads (avec contrôle du formulaire),
// la validation des réservations relève du CRM EasyV4.
export const ALLOWED_EVENTS = new Set([
  "Contact",
  "ViewContent",
  "CategoryView",
  "HotelClick",
  "FormStart",
  "ScrollDepth",
  "PageEngagement",
])
