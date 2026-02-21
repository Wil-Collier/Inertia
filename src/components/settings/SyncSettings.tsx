import { Cloud, CloudOff, RefreshCw, LogOut, AlertTriangle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useSync } from "@/features/sync/hooks"
import { SyncConflictDialog } from "@/components/settings/SyncConflictDialog"
import { useEffect, useRef } from "react"

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

function formatLastSync(timestamp: number | null) {
  if (!timestamp) return "Not synced yet"
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
}

const STATUS_STYLES = {
  idle: { label: "Idle", variant: "secondary" },
  syncing: { label: "Syncing", variant: "default" },
  success: { label: "Synced", variant: "default" },
  error: { label: "Error", variant: "destructive" },
  offline: { label: "Offline", variant: "outline" },
} as const

export function SyncSettings() {
  const { auth, sync, signInWithGoogle, signOut, resolveInitialSync, syncNow, syncEnabled } = useSync()
  const lastStatus = useRef(sync.status)

  useEffect(() => {
    if (!syncEnabled) return
    if (lastStatus.current !== sync.status) {
      if (sync.status === "error" && sync.lastError) {
        toast.error(sync.lastError)
      }
      lastStatus.current = sync.status
    }
  }, [sync.status, sync.lastError, syncEnabled])

  if (!syncEnabled) return null

  const statusConfig = STATUS_STYLES[sync.status]

  const handleLogin = (response: CredentialResponse) => {
    if (!response.credential) {
      toast.error("Google sign-in failed")
      return
    }

    void signInWithGoogle(response.credential).catch((error) => {
      const message = error instanceof Error ? error.message : "Failed to sign in"
      toast.error(message)
    })
  }

  const handleResolve = async (strategy: "merge" | "use-cloud" | "use-local") => {
    try {
      await resolveInitialSync(strategy)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to complete initial sync"
      toast.error(message)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base uppercase tracking-tight">
            <Cloud className="h-4 w-4" />
            Cloud Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            <span className="text-xs text-muted-foreground">
              Last sync: {formatLastSync(sync.lastSyncedAtMs)}
            </span>
          </div>

          {sync.lastError && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {sync.lastError}
            </div>
          )}

          {auth.isAuthenticated ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
                <p className="text-muted-foreground">Signed in as</p>
                <p className="font-semibold text-foreground">{auth.email}</p>
                <p className="mt-1 text-muted-foreground">Pending changes: {sync.pendingCount}</p>
              </div>

              {sync.conflicts.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <p className="font-semibold">Sync conflicts detected</p>
                  <p className="mt-1 text-destructive/80">
                    Conflicts were resolved with cloud data. Review recent changes if something looks off.
                  </p>
                </div>
              )}

              {sync.lastAutoMergeSummary && (
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Auto-merge completed</p>
                  <p className="mt-1">
                    merged: {sync.lastAutoMergeSummary.mergedRecords}, local wins: {sync.lastAutoMergeSummary.localWins},
                    cloud wins: {sync.lastAutoMergeSummary.remoteWins}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="flex-1" onClick={() => void syncNow({ source: "manual" })}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Now
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => void signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {!googleClientId ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  Missing `VITE_GOOGLE_CLIENT_ID`. Add it to your environment to enable sign-in.
                </div>
              ) : (
                <div className="flex justify-center">
                  <GoogleLogin onSuccess={handleLogin} onError={() => toast.error("Google sign-in failed")} />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Sync keeps workouts and nutrition aligned across devices.
              </p>
            </div>
          )}

          {!navigator.onLine && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CloudOff className="h-3 w-3" />
              Offline mode. Sync will resume when you reconnect.
            </div>
          )}
        </CardContent>
      </Card>

      <SyncConflictDialog
        open={!!sync.initialSyncState}
        state={sync.initialSyncState}
        onResolve={(strategy) => void handleResolve(strategy)}
        onOpenChange={(open) => {
          if (!open && sync.initialSyncState) {
            toast.info("Choose a sync option to continue")
          }
        }}
      />
    </>
  )
}
