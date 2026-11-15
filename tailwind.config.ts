import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // couleurs de marque Easy2Book : mêmes valeurs que les variables --e2b-* de app/globals.css
      colors: {
        e2b: { blue: "var(--e2b-blue)", "blue-dark": "var(--e2b-blue-dark)", "blue-soft": "var(--e2b-blue-soft)", yellow: "var(--e2b-yellow)", ink: "var(--e2b-ink)", wa: "var(--e2b-wa)" },
      },
    },
  },
  plugins: [],
}

export default config
