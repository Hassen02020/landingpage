// Seuls ces événements peuvent être relayés vers Meta / TikTok (pas d'événement arbitraire).
// "Lead" et "Purchase" sont exclus : Lead part de /api/leads (avec contrôle du formulaire),
// la validation des réservations passe par /api/leads/status (clé admin).
export const ALLOWED_EVENTS = new Set([
  "Contact",
  "ViewContent",
  "CategoryView",
  "HotelClick",
  "FormStart",
  "ScrollDepth",
  "PageEngagement",
])

// Événements enregistrés dans la table landing_events (contrainte CHECK identique en base).
export const LOGGED_EVENTS = new Set(["Contact", "ViewContent", "CategoryView", "HotelClick"])
