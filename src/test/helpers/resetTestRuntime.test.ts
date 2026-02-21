import { describe, expect, it } from "vitest"
import { db } from "@/services/db"
import { useAuthStore, useSyncStore } from "@/features/sync/runtime/store"
import { createFoodItem } from "@/test/factories/nutritionFactory"
import { resetEphemeralTestRuntime, resetTestRuntime } from "@/test/helpers/resetTestRuntime"

describe("resetTestRuntime", () => {
  it("clears DB records, browser storage, and sync/auth stores", async () => {
    await db.foods.put(createFoodItem({ id: "food-runtime" }))

    localStorage.setItem("x-test", "value")
    sessionStorage.setItem("x-session", "value")

    useAuthStore.setState({
      accessToken: "token",
      userId: "user",
      email: "user@example.com",
      expiresAtMs: Date.now() + 1000,
      isAuthenticated: true,
    })

    useSyncStore.setState({
      status: "error",
      lastError: "failed",
      pendingCount: 9,
      lastSyncedAtMs: Date.now(),
    })

    await resetTestRuntime()

    expect(await db.foods.get("food-runtime")).toBeUndefined()
    expect(localStorage.getItem("x-test")).toBeNull()
    expect(sessionStorage.getItem("x-session")).toBeNull()

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useSyncStore.getState().status).toBe("idle")
    expect(useSyncStore.getState().pendingCount).toBe(0)
    expect(useSyncStore.getState().lastError).toBeNull()
  })
})

describe("resetEphemeralTestRuntime", () => {
  it("clears browser storage and sync/auth stores without touching DB", async () => {
    await db.foods.put(createFoodItem({ id: "food-ephemeral" }))

    localStorage.setItem("x-test", "value")
    sessionStorage.setItem("x-session", "value")

    useAuthStore.setState({
      accessToken: "token",
      userId: "user",
      email: "user@example.com",
      expiresAtMs: Date.now() + 1000,
      isAuthenticated: true,
    })

    useSyncStore.setState({
      status: "error",
      lastError: "failed",
      pendingCount: 9,
      lastSyncedAtMs: Date.now(),
    })

    resetEphemeralTestRuntime()

    expect(await db.foods.get("food-ephemeral")).toBeTruthy()
    expect(localStorage.getItem("x-test")).toBeNull()
    expect(sessionStorage.getItem("x-session")).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useSyncStore.getState().status).toBe("idle")

    await db.foods.delete("food-ephemeral")
  })
})
