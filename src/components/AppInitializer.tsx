import { useEffect, useState, type ReactNode } from "react"
import { PageLoader } from "@/components/ui/PageLoader"
import { isDatabaseHealthy, recoverDatabase, exportDatabase } from "@/services/db"

interface AppInitializerProps {
  children: ReactNode
}

/**
 * Checks database health and initializes the application.
 */
export function AppInitializer({ children }: AppInitializerProps) {
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [showCorruptionPrompt, setShowCorruptionPrompt] = useState(false)
  const [isRecovering, setIsRecovering] = useState(false)

  useEffect(() => {
    async function initialize() {
      try {
        const healthy = await isDatabaseHealthy()
        if (!healthy) {
          console.warn("Database corruption detected")
          setShowCorruptionPrompt(true)
          return
        }
      } catch (err) {
        console.error("Database initialization failed:", err)
        setError(err instanceof Error ? err : new Error("Failed to initialize database"))
      } finally {
        setIsInitializing(false)
      }
    }
    
    void initialize()
  }, [])

  const handleExportBackup = async () => {
    try {
      const blob = await exportDatabase()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `inertia-corrupted-backup-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Failed to export backup:", err)
      // Still allow proceeding even if backup fails
    }
  }

  const handleRecoverDatabase = async () => {
    setIsRecovering(true)
    try {
      await recoverDatabase()
      window.location.reload()
    } catch (err) {
      console.error("Database recovery failed:", err)
      setError(err instanceof Error ? err : new Error("Failed to recover database"))
      setShowCorruptionPrompt(false)
      setIsInitializing(false)
    }
  }

  if (isInitializing) {
    return <PageLoader />
  }

  if (showCorruptionPrompt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="max-w-md w-full p-8 bg-card rounded-xl border shadow-lg">
          <h1 className="text-2xl font-bold text-destructive mb-4">Database Issue Detected</h1>
          <p className="text-muted-foreground mb-6">
            The app's database appears to be corrupted. To continue using the app, 
            the database needs to be reset. This will delete all your data.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            We recommend downloading a backup first. The backup may be incomplete 
            due to corruption, but it might help recover some data.
          </p>
          <div className="space-y-3">
            <button 
              onClick={handleExportBackup}
              disabled={isRecovering}
              className="w-full py-3 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Download Backup (Recommended)
            </button>
            <button 
              onClick={handleRecoverDatabase}
              disabled={isRecovering}
              className="w-full py-3 bg-destructive text-destructive-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isRecovering ? "Resetting..." : "Reset Database"}
            </button>
          </div>
        </div>
      </div>
    )
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
