import { useState } from "react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useSettings } from "@/features/settings/queries"
import { useUpdateSettings } from "@/features/settings/mutations"
import { useTheme } from "@/hooks/useTheme"
import { useSync } from "@/features/sync/hooks"
import {
  requestNotificationPermission,
  getNotificationPermission,
  isNotificationSupported,
} from "@/services/notifications"
import { toast } from "sonner"

// Internal Components
import { AppearanceSettings } from "@/components/settings/AppearanceSettings"
import { WorkoutSettings } from "@/components/settings/WorkoutSettings"
import { UnitSettings } from "@/components/settings/UnitSettings"
import { NutritionGoalSettings } from "@/components/settings/NutritionGoalSettings"
import { DataManagement } from "@/components/settings/DataManagement"
import { SyncSettings } from "@/components/settings/SyncSettings"

export function SettingsPage() {
  const updateSettingsMutation = useUpdateSettings()
  
  const { data: settings } = useSettings()
  const { auth, resetCloudData } = useSync()
  
  const { theme, setTheme } = useTheme()
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  if (!settings) return null

  const handleToggleNotifications = async () => {

    if (!isNotificationSupported()) {
      toast.error("Notifications not supported in this browser")
      return
    }

    if (settings.areNotificationsEnabled) {
      // Disable notifications
      await updateSettingsMutation.mutateAsync({ areNotificationsEnabled: false })
      toast.success("Notifications disabled")
    } else {
      // Request permission and enable
      const permission = await requestNotificationPermission()
      if (permission === "granted") {
        await updateSettingsMutation.mutateAsync({ areNotificationsEnabled: true })
        toast.success("Notifications enabled")
      } else if (permission === "denied") {
        toast.error("Notification permission denied. Please enable in browser settings.")
      } else {
        toast.error("Could not enable notifications")
      }
    }
  }

  // Check current notification permission status
  const notificationPermission = isNotificationSupported() ? getNotificationPermission() : "denied"
  const canEnableNotifications = isNotificationSupported() && notificationPermission !== "denied"

  const handleExport = () => {
    void (async () => {
      try {
        const { downloadExport } = await import("@/services/dataExport")
        await downloadExport()
        toast.success("Data exported successfully")
      } catch {
        toast.error("Failed to export data")
      }
    })()
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const { importData } = await import("@/services/dataExport")
    const result = await importData(file)
    if (result.success) {
      toast.success(result.message)
      if (result.shouldReload) {
        // Reload to reinitialize stores with imported data
        window.location.reload()
      }
    } else {
      toast.error(result.message)
    }

    // Reset input
    e.target.value = ""
  }

  const handleClearData = async () => {
    setIsClearing(true)
    try {
      if (auth.isAuthenticated) {
        try {
          await resetCloudData()
          toast.success("Cloud data deleted")
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to delete cloud data"
          toast.error(message)
          // Stop here if cloud deletion failed, to prevent inconsistent state
          // (clearing local but leaving cloud intact)
          return
        }
      }

      const { clearAllData } = await import("@/services/dataExport")
      await clearAllData()
      setShowClearDialog(false)
      toast.success("All data cleared")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to clear data"
      toast.error(message)
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] overflow-y-auto no-scrollbar pb-20">
      <Header title="Settings" />

      <div className="space-y-4 p-4">
        {/* Theme */}
        <AppearanceSettings theme={theme} setTheme={setTheme} />

        {/* Workout Settings */}
        <WorkoutSettings
          restTimerDuration={settings.restTimerDuration}
          onRestTimerChange={(duration) => updateSettingsMutation.mutate({ restTimerDuration: duration })}
          notificationsEnabled={settings.areNotificationsEnabled}
          onToggleNotifications={() => void handleToggleNotifications()}
          canEnableNotifications={canEnableNotifications}
          notificationPermission={notificationPermission as NotificationPermission}
        />

        {/* Units */}
        <UnitSettings
          weightUnit={settings.unitPreferences.weight}
          distanceUnit={settings.unitPreferences.distance}
          onWeightUnitChange={(weight) => updateSettingsMutation.mutate({ unitPreferences: { ...settings.unitPreferences, weight } })}
          onDistanceUnitChange={(distance) => updateSettingsMutation.mutate({ unitPreferences: { ...settings.unitPreferences, distance } })}
        />

        {/* Nutrition Goals */}
        <NutritionGoalSettings
          goals={settings.nutritionGoals}
          onGoalChange={(field, value) => updateSettingsMutation.mutate({ 
            nutritionGoals: { ...settings.nutritionGoals, [field]: value } 
          })}
        />

        {/* Cloud Sync */}
        <SyncSettings />

        {/* Data Management */}
        <DataManagement
          onExport={handleExport}
          onImport={(e) => void handleImport(e)}
          onClearAll={() => setShowClearDialog(true)}
        />

        {/* About */}
        <Card>
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            <p className="font-bold uppercase tracking-widest text-primary">Inertia v1.0.0</p>
            <p className="mt-1 font-medium">
              Mass in motion. Track your workouts and nutrition.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Clear Data Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Data?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              This will permanently delete all your workouts, nutrition logs,
              exercises, and settings from this device.
            </p>
            {auth.isAuthenticated && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <strong>Warning:</strong> Since you are signed in, this will also permanently delete
                ALL your data from the cloud. This action cannot be undone.
              </p>
            )}
            {!auth.isAuthenticated && (
              <p className="text-sm text-muted-foreground">
                This action cannot be undone.
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowClearDialog(false)}
                disabled={isClearing}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => void handleClearData()}
                disabled={isClearing}
              >
                {isClearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isClearing ? "Clearing..." : "Delete Everything"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
