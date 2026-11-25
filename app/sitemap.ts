import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/config"

// Pages publiques indexables. Les pages d'entreprises (/o/…), l'admin et l'API n'y figurent pas.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return ["", "/voyages-organises", "/omra", "/omra-sur-mesure", "/summer-vibes", "/confidentialite", "/suppression-donnees", "/mentions-legales"].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "/confidentialite" || path === "/suppression-donnees" || path === "/mentions-legales" ? "yearly" : "weekly",
    priority: path === "" ? 1 : path === "/confidentialite" || path === "/suppression-donnees" || path === "/mentions-legales" ? 0.2 : 0.8,
  }))
}
