import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  canShowNotifications,
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
  showRestTimerNotification,
} from "@/services/notifications"

class MockNotification {
  static permission: NotificationPermission = "default"
  static requestPermission = vi.fn(async () => MockNotification.permission)
  static instances: MockNotification[] = []

  readonly title: string
  readonly options?: NotificationOptions
  close = vi.fn()

  constructor(title: string, options?: NotificationOptions) {
    this.title = title
    this.options = options
    MockNotification.instances.push(this)
  }
}

type NotificationPermission = "granted" | "denied" | "default"

describe("notifications service", () => {
  let originalNotification: typeof Notification | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    originalNotification = globalThis.Notification
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      writable: true,
      value: MockNotification,
    })
    MockNotification.permission = "default"
    MockNotification.instances = []
  })

  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      writable: true,
      value: originalNotification,
    })
  })

  it("reports unsupported browsers and falls back to denied permission", () => {
    // @ts-expect-error test intentionally removes Notification support
    delete globalThis.Notification

    expect(isNotificationSupported()).toBe(false)
    expect(getNotificationPermission()).toBe("denied")
    expect(canShowNotifications()).toBe(false)
  })

  it("requests permission when status is default and returns resulting permission", async () => {
    MockNotification.permission = "default"
    MockNotification.requestPermission.mockResolvedValueOnce("granted")

    await expect(requestNotificationPermission()).resolves.toBe("granted")
    expect(MockNotification.requestPermission).toHaveBeenCalledTimes(1)
  })

  it("returns existing granted/denied permission without prompting again", async () => {
    MockNotification.permission = "granted"
    await expect(requestNotificationPermission()).resolves.toBe("granted")

    MockNotification.permission = "denied"
    await expect(requestNotificationPermission()).resolves.toBe("denied")

    expect(MockNotification.requestPermission).not.toHaveBeenCalled()
  })

  it("shows notification with defaults, auto-closes after 5 seconds, and canShowNotifications returns true", () => {
    MockNotification.permission = "granted"

    showRestTimerNotification()
    const notification = MockNotification.instances[0]
    if (!notification) {
      throw new Error("Expected notification instance")
    }

    expect(notification.title).toBe("Rest Complete!")
    expect(notification.options).toMatchObject({
      body: "Time to start your next set",
      tag: "rest-timer",
      icon: "/icon.svg",
      badge: "/icon.svg",
    })
    expect(canShowNotifications()).toBe(true)

    vi.advanceTimersByTime(5000)
    expect(notification.close).toHaveBeenCalledTimes(1)
  })

  it("does not show notification when permission is not granted", () => {
    MockNotification.permission = "denied"
    expect(showRestTimerNotification()).toBeNull()
    expect(canShowNotifications()).toBe(false)
  })
})
