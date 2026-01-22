import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { PageLoader } from "@/components/ui/PageLoader"

// Lazily load the seeding function only in DEV mode
async function loadAndSeed() {
  const { seedTestData } = await import("@/services/devSeeding")
  await seedTestData()
}

function DevSeedingHandlerInner() {
  const navigate = useNavigate()
  const [isSeeding, setIsSeeding] = useState(false)

  useEffect(() => {
    let isMounted = true

    // Only run seeding in DEV mode with ?seed=true query param
    // We check window.location.search directly to bypass TanStack Router's strict validation
    const params = new URLSearchParams(window.location.search)
    const shouldSeed = params.get("seed") === "true"

    if (import.meta.env.DEV && shouldSeed) {
      const runSeed = async () => {
        console.log("DevSeedingHandler: Seeding triggered via URL param")
        setIsSeeding(true)
        try {
          await loadAndSeed()
          
          if (!isMounted) return

          console.log("DevSeedingHandler: Seeding successful, cleaning up URL...")
          // Remove the seed param and reload to ensure all stores are fresh
          await navigate({ 
            to: "/",
            search: (old: Record<string, unknown>) => {
              const { seed: _, ...rest } = old
              return rest
            } 
          })
          window.location.reload()
        } catch (error) {
          console.error("DevSeedingHandler: Seeding failed:", error)
          if (isMounted) {
            setIsSeeding(false)
          }
        }
      }
      void runSeed()
    }

    return () => {
      isMounted = false
    }
  }, [navigate])

  if (isSeeding) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
        <PageLoader />
        <p className="mt-4 font-medium animate-pulse">Seeding demo data...</p>
      </div>
    )
  }

  return null
}

export function DevSeedingHandler() {
  // Only render in DEV mode to prevent any code from running in production
  if (!import.meta.env.DEV) {
    return null
  }
  
  return <DevSeedingHandlerInner />
}
