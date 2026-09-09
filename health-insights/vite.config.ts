/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// GitHub Pages serves a project site at https://<user>.github.io/<repo-name>/, so
// the build needs every asset URL prefixed with the repo name — set via this env var
// by .github/workflows/deploy.yml. Local `npm run dev`/`vite build` outside CI still
// uses "/". If your GitHub repo name isn't "health-insights", update the fallback
// below (or the workflow's env var) to match.
const BASE_PATH = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Health Insights",
        short_name: "Insights",
        description: "Local-first nutrition, training, and cycle insights.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        // Relative, not absolute — resolves correctly whether the app is served at
        // the domain root (local dev) or under /health-insights/ (GitHub Pages).
        start_url: ".",
        scope: ".",
        // A real app icon set (192/512 PNG, maskable variant) is a nice-to-have
        // polish item — tracked, not required for the build/deploy pipeline to work.
        // Referencing only the SVG that actually exists in public/ keeps this build
        // honest instead of pointing at files that don't exist yet.
        icons: [{ src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: {
        // App shell + static assets only — IndexedDB data is never part of the
        // precache; the service worker's job is offline app-shell load, not data sync.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@domain": path.resolve(__dirname, "src/domain"),
      "@storage": path.resolve(__dirname, "src/storage"),
      "@integrations": path.resolve(__dirname, "src/integrations"),
      "@app": path.resolve(__dirname, "src/app"),
      "@ui": path.resolve(__dirname, "src/ui"),
    },
  },
  server: { port: 5174 },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.ts"],
  },
});
