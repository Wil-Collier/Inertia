import { useState, useRef } from "react"
import {
  Sun,
  Moon,
  Monitor,
  Download,
  Upload,
  Trash2,
  Target,
  Timer,
  Ruler,
  Bell,
  BellOff,
} from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useSettingsStore } from "@/stores/settingsStore"
import { useTheme } from "@/hooks/useTheme"
import { downloadExport, importData, clearAllData } from "@/services/dataExport"
import {
  requestNotificationPermission,
  getNotificationPermission,
  isNotificationSupported,
} from "@/services/notifications"
import { toast } from "sonner"
import type { ThemeMode, WeightUnit, DistanceUnit } from "@/lib/types"

export function SettingsPage() {
  const { settings, updateNutritionGoal, setRestTimerDuration, setWeightUnit, setDistanceUnit, setNotificationsEnabled } = useSettingsStore()
  const { theme, setTheme } = useTheme()
  const [showClearDialog, setShowClearDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleToggleNotifications = async () => {
    if (!isNotificationSupported()) {
      toast.error("Notifications not supported in this browser")
      return
    }

    if (settings.notificationsEnabled) {
      // Disable notifications
      await setNotificationsEnabled(false)
      toast.success("Notifications disabled")
    } else {
      // Request permission and enable
      const permission = await requestNotificationPermission()
      if (permission === "granted") {
        await setNotificationsEnabled(true)
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
    downloadExport()
    toast.success("Data exported successfully")
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const result = await importData(file)
    if (result.success) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleClearData = async () => {
    try {
      await clearAllData()
      setShowClearDialog(false)
      toast.success("All data cleared")
    } catch {
      toast.error("Failed to clear data")
    }
  }

  const themeOptions: { value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ]

  const weightUnitOptions: { value: WeightUnit; label: string }[] = [
    { value: "lbs", label: "Pounds (lbs)" },
    { value: "kg", label: "Kilograms (kg)" },
  ]

  const distanceUnitOptions: { value: DistanceUnit; label: string }[] = [
    { value: "mi", label: "Miles (mi)" },
    { value: "km", label: "Kilometers (km)" },
  ]

  return (
    <div className="flex flex-col">
      <Header title="Settings" />

      <div className="space-y-4 p-4">
        {/* Theme */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={theme === value ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => {
                    setTheme(value)
                  }}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Workout Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="h-4 w-4" />
              Workout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Rest Timer Duration (seconds)</Label>
              <Input
                type="number"
                min={0}
                max={600}
                value={settings.restTimerDuration}
                onChange={(e) => {
                  setRestTimerDuration(parseInt(e.target.value) || 0)
                }}
              />
              <p className="text-xs text-muted-foreground">
                Default rest time between sets (0-600 seconds)
              </p>
            </div>

            {/* Notifications */}
            <div className="space-y-2">
              <Label>Rest Timer Notifications</Label>
              <Button
                variant={settings.notificationsEnabled ? "default" : "outline"}
                className="w-full justify-start"
                onClick={handleToggleNotifications}
                disabled={!canEnableNotifications && !settings.notificationsEnabled}
              >
                {settings.notificationsEnabled ? (
                  <>
                    <Bell className="mr-2 h-4 w-4" />
                    Notifications Enabled
                  </>
                ) : (
                  <>
                    <BellOff className="mr-2 h-4 w-4" />
                    Notifications Disabled
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                {notificationPermission === "denied" 
                  ? "Notifications blocked. Please enable in browser settings."
                  : "Get notified when rest timer completes (even when app is in background)"
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Units */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Ruler className="h-4 w-4" />
              Units
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Weight</Label>
              <div className="flex gap-2">
                {weightUnitOptions.map(({ value, label }) => (
                  <Button
                    key={value}
                    variant={settings.unitPreferences.weight === value ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => {
                      setWeightUnit(value)
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Used for body weight and workout weights
              </p>
            </div>

            <div className="space-y-2">
              <Label>Distance</Label>
              <div className="flex gap-2">
                {distanceUnitOptions.map(({ value, label }) => (
                  <Button
                    key={value}
                    variant={settings.unitPreferences.distance === value ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => {
                      setDistanceUnit(value)
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Used for running, walking, and cardio distances
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Nutrition Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              Daily Nutrition Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Calories (kcal)</Label>
              <Input
                type="number"
                value={settings.nutritionGoals.calories}
                onChange={(e) => {
                  updateNutritionGoal("calories", parseInt(e.target.value) || 0)
                }}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Protein (g)</Label>
                <Input
                  type="number"
                  value={settings.nutritionGoals.protein}
                  onChange={(e) => {
                    updateNutritionGoal("protein", parseInt(e.target.value) || 0)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Carbs (g)</Label>
                <Input
                  type="number"
                  value={settings.nutritionGoals.carbs}
                  onChange={(e) => {
                    updateNutritionGoal("carbs", parseInt(e.target.value) || 0)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Fat (g)</Label>
                <Input
                  type="number"
                  value={settings.nutritionGoals.fat}
                  onChange={(e) => {
                    updateNutritionGoal("fat", parseInt(e.target.value) || 0)
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fiber (g)</Label>
                <Input
                  type="number"
                  value={settings.nutritionGoals.fiber}
                  onChange={(e) => {
                    updateNutritionGoal("fiber", parseInt(e.target.value) || 0)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Sugar (g)</Label>
                <Input
                  type="number"
                  value={settings.nutritionGoals.sugar}
                  onChange={(e) => {
                    updateNutritionGoal("sugar", parseInt(e.target.value) || 0)
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleExport}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Data (JSON)
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Data
            </Button>

            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={() => setShowClearDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All Data
            </Button>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            <p>Training App v1.0.0</p>
            <p className="mt-1">
              Track your workouts and nutrition
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
              exercises, and settings. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowClearDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleClearData}
              >
                Delete Everything
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
