import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/design-system/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // couleurs de marque Easy2Book : mêmes valeurs que les variables --e2b-* de app/globals.css
      colors: {
        e2b: { blue: "var(--e2b-blue)", "blue-dark": "var(--e2b-blue-dark)", "blue-soft": "var(--e2b-blue-soft)", yellow: "var(--e2b-yellow)", ink: "var(--e2b-ink)", wa: "var(--e2b-wa)", "wa-dark": "var(--e2b-wa-dark)", "surface-omra": "var(--e2b-surface-omra)", "line-omra": "var(--e2b-line-omra)" },
        // échelle « brand » (LOT 1) : espace équipe et pages d'erreur ; toutes les valeurs passent par les variables --e2b-*
        brand: {
          50: "var(--e2b-blue-50)", 100: "var(--e2b-blue-soft)", 200: "var(--e2b-blue-200)", 300: "var(--e2b-blue-300)", 400: "var(--e2b-blue-400)",
          500: "var(--e2b-blue-500)", 600: "var(--e2b-blue-600)", 700: "var(--e2b-blue)", 800: "var(--e2b-blue-dark)", 900: "var(--e2b-blue-900)", 950: "var(--e2b-blue-950)",
        },
      },
    },
  },
  plugins: [],
}

export default config
