/** @type {import('next').NextConfig} */
const nextConfig = {
  // envoi d'images depuis /admin/catalogue (4 Mo max, vérifié côté serveur)
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ]
    return [
      { source: "/:path*", headers: [...common, { key: "X-Frame-Options", value: "SAMEORIGIN" }] },
      // espace équipe : jamais mis en cache, jamais affiché dans un cadre, jamais indexé
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ]
  },
  // UNE seule règle, sans joker : /omra-2027 n'existe pas (la catégorie « omra-2027 » est servie par /omra ; /c/omra-2027 redirige déjà dans sa page).
  // Redirection TEMPORAIRE (307) : tous les paramètres de la requête (UTM, clics publicitaires, clés répétées, valeurs encodées) sont conservés.
  // Ne pas passer en 308 (mise en cache durable par les navigateurs) sans nouvelle autorisation.
  async redirects() {
    return [{ source: "/omra-2027", destination: "/omra", permanent: false }]
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
}

export default nextConfig
