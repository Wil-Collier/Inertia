const DEVICE_ID_KEY = "kinetic-device-id"

export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

export function clearDeviceId(): void {
  localStorage.removeItem(DEVICE_ID_KEY)
}
