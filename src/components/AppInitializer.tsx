import { useEffect, useState, type ReactNode } from "react"
import { PageLoader } from "@/components/ui/PageLoader"
import { isDatabaseHealthy, recoverDatabase } from "@/services/db"
import { achievementService } from "@/services/achievementService"
import { statsService } from "@/services/statsService"
import { registerSyncDexieHooks } from "@/features/sync/dexieHooks"
import { useSyncTriggers } from "@/features/sync/useSyncTriggers"
import { useDebouncedPush } from "@/features/sync/useDebouncedPush"
import { SYNC_ENABLED } from "@/features/sync/syncEngine"
import { restoreSession } from "@/features/sync/api"
import { rebuildLocalOnlyFields } from "@/features/sync/localRebuild"
import { shouldAttemptSessionRestore } from "@/features/sync/sessionRestoreHint"
import type { SyncCollection } from "@/features/sync/schemas"

interface AppInitializerProps {
  children: ReactNode
}

async function exportBackup() {
  try {
    // Use downloadExport to create a properly wrapped backup that can be imported
    const { downloadExport } = await import("@/services/dataExport")
    await downloadExport()
  } catch (err) {
    console.error("Failed to export backup:", err)
    // Still allow proceeding even if backup fails
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isSafariCursorError(err: unknown): boolean {
  const name = isRecord(err) && typeof err["name"] === "string" ? err["name"] : ""
  const message = isRecord(err) && typeof err["message"] === "string" ? err["message"] : ""
  const inner = isRecord(err) ? err["inner"] : undefined
  const innerMessage = isRecord(inner) && typeof inner["message"] === "string" ? inner["message"] : ""

  return (
    name === "UnknownError" && (message.includes("Unable to open cursor") || innerMessage.includes("Unable to open cursor"))
  )
}

function isMissingObjectStoreError(err: unknown): boolean {
  const name = isRecord(err) && typeof err["name"] === "string" ? err["name"] : ""
  const message = isRecord(err) && typeof err["message"] === "string" ? err["message"] : ""
  const inner = isRecord(err) ? err["inner"] : undefined
  const innerMessage = isRecord(inner) && typeof inner["message"] === "string" ? inner["message"] : ""

  return (
    name === "VersionError" ||
    name === "NotFoundError" ||
    message.includes("object store") ||
    message.includes("version") ||
    innerMessage.includes("object store")
  )
}

async function sleep(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function withSafariRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const delays = [0, 50, 150, 400]

  const attempt = async (i: number, lastError: unknown): Promise<T> => {
    if (i >= delays.length) {
      throw lastError instanceof Error ? lastError : new Error(`${label} failed`)
    }

    if (i > 0) {
      await sleep(delays[i])
      console.warn(`${label} failed; retrying (${i + 1}/${delays.length})`, lastError)
    }

    try {
      return await fn()
    } catch (err) {
      if (!isSafariCursorError(err)) {
        throw err
      }
      return await attempt(i + 1, err)
    }
  }

  return await attempt(0, undefined)
}

const STARTUP_REPAIR_COLLECTIONS: Set<SyncCollection> = new Set(["workouts", "nutrition", "foods"])

/**
 * Checks database health and initializes the application.
 */
export function AppInitializer({ children }: AppInitializerProps) {
  useSyncTriggers()
  useDebouncedPush()

  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [showCorruptionPrompt, setShowCorruptionPrompt] = useState(false)
  const [isRecovering, setIsRecovering] = useState(false)

  useEffect(() => {
    let midnightTimeoutId: number | undefined
    let dailyIntervalId: number | undefined

    async function initialize() {
      try {
        const healthy = await withSafariRetry("Database health check", isDatabaseHealthy)
        if (!healthy) {
          console.warn("Database corruption detected")
          setShowCorruptionPrompt(true)
          return
        }

        if (SYNC_ENABLED) {
          registerSyncDexieHooks()
          if (shouldAttemptSessionRestore()) {
            void restoreSession()
          }
        }

        // Initialize/repair derived state (early dev: correctness > micro perf).
        await withSafariRetry("Local-only field rebuild", () =>
          rebuildLocalOnlyFields(STARTUP_REPAIR_COLLECTIONS)
        )
        await withSafariRetry("Achievement init", () => achievementService.ensureInitialized())
        await withSafariRetry("Streak recalculation", () => achievementService.updateStreaks())
        await withSafariRetry("Stats recalculation", () => statsService.recalculateAll())
        await withSafariRetry("Workout achievement reconciliation", async () => {
          const { exerciseDatabaseMap } = await import("@/data/exerciseDatabase")
          await achievementService.checkWorkoutAchievements(exerciseDatabaseMap)
        })
        await withSafariRetry("Nutrition achievement reconciliation", () => achievementService.checkNutritionAchievements())

        // Keep streaks correct if the app stays open across midnight.
        const now = new Date()
        const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        const msUntilMidnight = nextMidnight.getTime() - now.getTime() + 1000

        midnightTimeoutId = window.setTimeout(() => {
          void achievementService.updateStreaks().catch((err) => {
            console.error("Failed to refresh streaks:", err)
          })

          dailyIntervalId = window.setInterval(() => {
            void achievementService.updateStreaks().catch((err) => {
              console.error("Failed to refresh streaks:", err)
            })
          }, 24 * 60 * 60 * 1000)
        }, msUntilMidnight)
      } catch (err) {
        console.error("Database initialization failed:", err)

        // For Safari cursor/schema issues, prefer recovery/reset UI over a dead-end error screen.
        if (isSafariCursorError(err) || isMissingObjectStoreError(err)) {
          setShowCorruptionPrompt(true)
          return
        }

        setError(err instanceof Error ? err : new Error("Failed to initialize database"))
      } finally {
        setIsInitializing(false)
      }
    }

    void initialize()

    return () => {
      if (midnightTimeoutId !== undefined) {
        clearTimeout(midnightTimeoutId)
      }
      if (dailyIntervalId !== undefined) {
        clearInterval(dailyIntervalId)
      }
    }
  }, [])

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
              onClick={() => void exportBackup()}
              disabled={isRecovering}
              className="w-full py-3 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Download Backup (Recommended)
            </button>
            <button
              onClick={() => void handleRecoverDatabase()}
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
