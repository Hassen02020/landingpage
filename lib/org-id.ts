// Identifiants d'organisation (sans dépendance serveur : importable partout).
/** Organisation n°1 (Easy2Book), créée par la migration 0008. */
export const DEFAULT_ORG_ID = "00000000-0000-4000-8000-0000000e2b01"
export const ORG_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isOrgId = (v: unknown): v is string => typeof v === "string" && ORG_ID_RE.test(v)
