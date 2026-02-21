import { beforeEach, describe, expect, it } from "vitest"
import { clearDeviceId, getDeviceId } from "@/features/sync/client/deviceId"

describe("device id helpers", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("creates a device id once and reuses it across reads", () => {
    const first = getDeviceId()
    const second = getDeviceId()

    expect(first).toBeTruthy()
    expect(second).toBe(first)
  })

  it("clears device id and generates a new one next time", () => {
    const first = getDeviceId()
    clearDeviceId()
    const second = getDeviceId()

    expect(second).not.toBe(first)
  })
})
