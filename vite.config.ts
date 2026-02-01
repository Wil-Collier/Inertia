import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type PluginOption } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { cloudflare } from "@cloudflare/vite-plugin"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter(),
    react(),
    tailwindcss(),
    cloudflare(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Inertia",
        short_name: "Inertia",
        description: "Mass in motion. Track your workouts and nutrition.",
        theme_color: "#ea580c",
        background_color: "#0a0a0a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
          {
            src: "icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/nutrition\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "nutrition-api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }) as PluginOption,
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("@tanstack/react-router") || id.includes("@tanstack/react-query")) {
              return "vendor-tanstack"
            }
            if (id.includes("recharts")) {
              return "vendor-recharts"
            }
            if (id.includes("zustand") || id.includes("date-fns")) {
              return "vendor-utils"
            }
            if (id.includes("html5-qrcode")) {
              return "vendor-barcode"
            }
            // Match exactly react or react-dom packages, avoiding matches like 'lucide-react'
            if (id.includes("/react/") || id.includes("/react-dom/")) {
              return "vendor-react"
            }
          }
        },
      },
    },
  },
})
