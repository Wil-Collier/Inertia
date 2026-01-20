import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"

import "./index.css"
import App from "./App.tsx"
import { queryClient } from "@/lib/queryClient"

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("Root element not found. Make sure there is a <div id=\"root\"></div> in your HTML.")
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)
