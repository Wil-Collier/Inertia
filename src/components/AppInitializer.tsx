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
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function initialize() {
      try {
        // Check database health
        const healthy = await isDatabaseHealthy()
        if (!healthy) {
          console.warn("Database corruption detected, attempting recovery...")
          await recoverDatabase()
        }
      } catch (err) {
        console.error("Database initialization/recovery failed:", err)
        setError(err instanceof Error ? err : new Error("Failed to initialize database"))
      } finally {
        setIsInitializing(false)
      }
    }
    
    initialize()
  }, [])

  if (isInitializing) {
    return <PageLoader />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="max-w-md w-full p-8 bg-card rounded-xl border shadow-lg">
          <h1 className="text-2xl font-bold text-destructive mb-4">Critical Error</h1>
          <p className="text-muted-foreground mb-6">
            The application failed to initialize its database. This may be due to a corrupted browser storage.
          </p>
          <div className="p-4 bg-muted rounded-md text-left text-xs font-mono mb-6 overflow-auto max-h-32">
            {error.message}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Reload Application
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
