import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/config"

// Pages publiques indexables. Les pages d'entreprises (/o/…), l'admin et l'API n'y figurent pas.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return ["", "/voyages-organises", "/omra", "/summer-vibes", "/confidentialite"].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "/confidentialite" ? "yearly" : "weekly",
    priority: path === "" ? 1 : path === "/confidentialite" ? 0.2 : 0.8,
  }))
}
