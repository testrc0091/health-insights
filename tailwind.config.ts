import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        // User explicitly requested a pink theme this session — overrides the earlier
        // "avoid a pink women's health app" starting assumption. Kept calm/non-garish
        // by staying single-accent: neutral slate/white surfaces, pink only for
        // buttons, active nav, progress rings, and chart series — not a full reskin.
        accent: {
          DEFAULT: "#ec4899",
          muted: "#f9a8d4",
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
