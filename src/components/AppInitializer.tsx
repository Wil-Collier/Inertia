import { useEffect, useState, type ReactNode } from "react"
import { PageLoader } from "@/components/ui/PageLoader"
import { isDatabaseHealthy, recoverDatabase } from "@/services/db"

interface AppInitializerProps {
  children: ReactNode
}

/**
 * Checks database health and initializes the application.
 */
export function AppInitializer({ children }: AppInitializerProps) {
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    async function initialize() {
      // Check database health
      const healthy = await isDatabaseHealthy()
      if (!healthy) {
        console.warn("Database corruption detected, attempting recovery...")
        try {
          await recoverDatabase()
        } catch (error) {
          console.error("Database recovery failed:", error)
        }
      }
      
      setIsInitializing(false)
    }
    
    initialize()
  }, [])

  if (isInitializing) {
    return <PageLoader />
  }

  return <>{children}</>
}
