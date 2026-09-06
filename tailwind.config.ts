import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1320px" },
    },
    extend: {
      colors: {
        ink: {
          DEFAULT: "#161A18",
          50: "#F5F6F5",
          100: "#E6E8E6",
          200: "#C7CCC8",
          300: "#9BA39D",
          400: "#6C766E",
          500: "#4A544C",
          600: "#373F39",
          700: "#282E2A",
          800: "#1D2220",
          900: "#161A18",
        },
        forest: {
          DEFAULT: "#1B4332",
          50: "#EAF3EE",
          100: "#CFE4D8",
          200: "#A2CBB5",
          300: "#70AE8E",
          400: "#3F8B69",
          500: "#256B4C",
          600: "#1B4332",
          700: "#173A2B",
          800: "#122D22",
          900: "#0D2118",
        },
        coral: {
          DEFAULT: "#E15B3F",
          50: "#FDEEEA",
          100: "#FAD6CB",
          200: "#F3AB98",
          300: "#EC8264",
          400: "#E56C4E",
          500: "#E15B3F",
          600: "#C24630",
          700: "#983726",
          800: "#6F291C",
          900: "#4A1C13",
        },
        sand: {
          DEFAULT: "#F3ECDF",
          50: "#FDFBF7",
          100: "#F9F4E9",
          200: "#F3ECDF",
          300: "#E9DCC1",
          400: "#DCC89D",
        },
        cream: "#FBF8F2",
        gold: "#C99A3F",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(22,26,24,0.04), 0 4px 16px rgba(22,26,24,0.06)",
        popover: "0 8px 30px rgba(22,26,24,0.12)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
      },
    },
  },
  plugins: [],
}

export default config
