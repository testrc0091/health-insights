import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        // Calm, non-clinical palette — explicitly not a "pink women's health app"
        // (brief's own instruction). Neutral slate ground with a single accent.
        accent: {
          DEFAULT: "#6366f1",
          muted: "#a5b4fc",
        },
        surface: {
          DEFAULT: "#ffffff",
          dark: "#111827",
        },
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
  plugins: [],
} satisfies Config;
