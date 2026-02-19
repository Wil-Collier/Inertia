import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { type PluginOption } from "rolldown-vite"
import { defineConfig } from "vitest/config"
import { VitePWA } from "vite-plugin-pwa"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { cloudflare } from "@cloudflare/vite-plugin"


const isVitest = process.env.VITEST === "true"

const CLIENT_TEST_INCLUDE = [
  "src/**/*.test.ts",
  "src/**/*.test.tsx",
  "src/**/*.spec.ts",
  "src/**/*.spec.tsx",
  "src/**/*.integration.test.ts",
  "src/**/*.integration.test.tsx",
]

const WORKER_TEST_INCLUDE = [
  "worker/**/*.test.ts",
  "worker/**/*.test.tsx",
  "worker/**/*.integration.test.ts",
  "worker/**/*.integration.test.tsx",
]

const SHARED_TEST_INCLUDE = [
  "shared/**/*.test.ts",
  "shared/**/*.test.tsx",
]

// https://vite.dev/config/
// eslint-disable-next-line @typescript-eslint/no-explicit-any, typescript-eslint/no-unsafe-type-assertion
export default (defineConfig as any)({
  plugins: [
    tanstackRouter(),
    react(),
    tailwindcss(),
    ...(!isVitest ? [cloudflare()] : []),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
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
        // SECURITY: Only cache public, non-user-specific API responses.
        // Never add /api/sync/* or /api/auth/* to runtimeCaching as these
        // contain user-specific data that must not be shared across sessions
        // or leak between users on shared devices.
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/nutrition/"),
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
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/react-router",
    ],
    rolldownOptions: {
      target: "es2019",
    },
  },
  build: {
    target: "es2019",
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes("node_modules")) {
            const isReact =
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/react/jsx-runtime") ||
              id.includes("/react/jsx-dev-runtime")
            const isTanstack = id.includes("@tanstack/react-router") || id.includes("@tanstack/react-query")
            if (isReact || isTanstack) {
              return "vendor-core"
            }
            if (id.includes("recharts")) {
              return "vendor-recharts"
            }
            if (id.includes("zustand") || id.includes("date-fns")) {
              return "vendor-utils"
            }
            if (id.includes("quagga2")) {
              return "vendor-barcode"
            }
          }
        },
      },
    },
  },
  test: {
    pool: "threads",
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          environment: "jsdom",
          setupFiles: "./src/test/setup.ts",
          include: CLIENT_TEST_INCLUDE,
        },
      },
      {
        extends: true,
        test: {
          name: "worker",
          environment: "node",
          include: WORKER_TEST_INCLUDE,
        },
      },
      {
        extends: true,
        test: {
          name: "shared",
          environment: "node",
          include: SHARED_TEST_INCLUDE,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}", "worker/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}"],
      exclude: [
        "**/*.d.ts",
        "**/*.test.*",
        "**/*.spec.*",
        "**/*.integration.test.*",
        "src/test/**",
        "src/routeTree.gen.ts",
        "e2e/**",
      ],
    },
  },
})
