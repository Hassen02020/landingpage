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
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
}

export default nextConfig
