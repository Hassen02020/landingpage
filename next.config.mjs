/** @type {import('next').NextConfig} */
const nextConfig = {
  // envoi d'images depuis /admin/catalogue (4 Mo max, vérifié côté serveur)
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
}

export default nextConfig
