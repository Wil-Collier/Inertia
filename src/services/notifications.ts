/**
 * Notifications Service
 * 
 * Provides helpers for requesting notification permissions and showing
 * notifications for rest timer alerts.
 */

export type NotificationPermission = "granted" | "denied" | "default"

/**
 * Check if the browser supports notifications
 */
export function isNotificationSupported(): boolean {
  return "Notification" in window
}

/**
 * Get the current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) {
    return "denied"
  }
  return Notification.permission as NotificationPermission
}

/**
 * Request notification permission from the user
 * @returns The resulting permission status
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    console.warn("Notifications not supported in this browser")
    return "denied"
  }

  // If already granted or denied, return current status
  const current = Notification.permission
  if (current === "granted" || current === "denied") {
    return current as NotificationPermission
  }

  try {
    const result = await Notification.requestPermission()
    return result as NotificationPermission
  } catch (error) {
    console.error("Error requesting notification permission:", error)
    return "denied"
  }
}

/**
 * Show a notification
 * @param title - The notification title
 * @param options - Notification options (body, icon, tag, etc.)
 */
export function showNotification(
  title: string,
  options?: NotificationOptions
): Notification | null {
  if (!isNotificationSupported()) {
    console.warn("Notifications not supported")
    return null
  }

  if (Notification.permission !== "granted") {
    console.warn("Notification permission not granted")
    return null
  }

  try {
    const notification = new Notification(title, {
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: "training-app",
      ...options,
    })

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close()
    }, 5000)

    return notification
  } catch (error) {
    console.error("Error showing notification:", error)
    return null
  }
}

/**
 * Show a rest timer completion notification
 */
export function showRestTimerNotification(): Notification | null {
  return showNotification("Rest Complete!", {
    body: "Time to start your next set",
    tag: "rest-timer",
    requireInteraction: false,
    silent: false,
  })
}

/**
 * Check if notifications can be shown
 * (supported and permission granted)
 */
export function canShowNotifications(): boolean {
  return isNotificationSupported() && Notification.permission === "granted"
}

/**
 * Vibrate the device if supported (for haptic feedback)
 */
export function vibrateDevice(pattern: number | number[] = 200): boolean {
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(pattern)
      return true
    } catch {
      return false
    }
  }
  return false
}
