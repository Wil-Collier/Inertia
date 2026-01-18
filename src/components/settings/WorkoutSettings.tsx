import { Timer, Bell, BellOff } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface WorkoutSettingsProps {
  restTimerDuration: number
  onRestTimerChange: (duration: number) => void
  notificationsEnabled: boolean
  onToggleNotifications: () => void
  canEnableNotifications: boolean
  notificationPermission: NotificationPermission
}

export function WorkoutSettings({
  restTimerDuration,
  onRestTimerChange,
  notificationsEnabled,
  onToggleNotifications,
  canEnableNotifications,
  notificationPermission,
}: WorkoutSettingsProps) {
  return (
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
            value={restTimerDuration}
            onChange={(e) => onRestTimerChange(parseInt(e.target.value) || 0)}
          />
          <p className="text-xs text-muted-foreground">
            Default rest time between sets (0-600 seconds)
          </p>
        </div>

        {/* Notifications */}
        <div className="space-y-2">
          <Label>Rest Timer Notifications</Label>
          <Button
            variant={notificationsEnabled ? "default" : "outline"}
            className="w-full justify-start"
            onClick={onToggleNotifications}
            disabled={!canEnableNotifications && !notificationsEnabled}
          >
            {notificationsEnabled ? (
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
  )
}
