import { describe, it, expect, vi, beforeEach } from "vitest"
import { performOptimisticUpdate } from "./storeUtils"
import { toast } from "sonner"

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

describe("performOptimisticUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("should perform optimistic update and save successfully", async () => {
    const currentValue = 10
    const updateFn = vi.fn()
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const calculatorFn = (current: number) => current + 1

    await performOptimisticUpdate(currentValue, updateFn, saveFn, calculatorFn)

    // Should calculate new value and update store
    expect(updateFn).toHaveBeenCalledWith(11)

    // Should attempt to save new value
    expect(saveFn).toHaveBeenCalledWith(11)

    // Should not rollback (called only once)
    expect(updateFn).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("should rollback optimistic update when save fails", async () => {
    const currentValue = 20
    const updateFn = vi.fn()
    const saveFn = vi.fn().mockRejectedValue(new Error("Network Error"))
    const calculatorFn = (current: number) => current - 5
    const errorMessage = "Failed to update item"

    await performOptimisticUpdate(currentValue, updateFn, saveFn, calculatorFn, errorMessage)

    // 1. Should update store with new value (optimistic)
    expect(updateFn).toHaveBeenNthCalledWith(1, 15)

    // 2. Should attempt to save new value
    expect(saveFn).toHaveBeenCalledWith(15)

    // 3. Should show error toast
    expect(toast.error).toHaveBeenCalledWith(errorMessage)

    // 4. Should rollback to original value
    expect(updateFn).toHaveBeenNthCalledWith(2, 20)
    expect(updateFn).toHaveBeenCalledTimes(2)
  })

  it("should not perform update if currentValue is null", async () => {
    const updateFn = vi.fn()
    const saveFn = vi.fn()
    const calculatorFn = (current: number) => current + 1

    await performOptimisticUpdate(null, updateFn, saveFn, calculatorFn)

    expect(updateFn).not.toHaveBeenCalled()
    expect(saveFn).not.toHaveBeenCalled()
  })

  it("should not perform update if currentValue is undefined", async () => {
    const updateFn = vi.fn()
    const saveFn = vi.fn()
    const calculatorFn = (current: number) => current + 1

    await performOptimisticUpdate(undefined, updateFn, saveFn, calculatorFn)

    expect(updateFn).not.toHaveBeenCalled()
    expect(saveFn).not.toHaveBeenCalled()
  })
})
