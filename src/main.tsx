import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { GoogleOAuthProvider } from "@react-oauth/google"

import "./index.css"
import App from "./App.tsx"
import { queryClient } from "@/lib/queryClient"
import { registerPwaUpdates } from "@/pwa/registerPwaUpdates"

const syncEnabled = import.meta.env.VITE_ENABLE_SYNC !== "false"
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("Root element not found. Make sure there is a <div id=\"root\"></div> in your HTML.")
}

registerPwaUpdates()

const app = (
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)

const wrappedApp =
  syncEnabled && googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      {app}
    </GoogleOAuthProvider>
  ) : (
    app
  )

createRoot(rootElement).render(
  <StrictMode>
    {wrappedApp}
  </StrictMode>
)
