import type { Page } from "@playwright/test"

interface StoredSettings {
  id: string
  restTimerDuration: number
  unitPreferences: {
    weight: "lbs" | "kg"
    distance: "mi" | "km"
  }
}

export async function readStoredSettings(page: Page): Promise<StoredSettings | null> {
  return await page.evaluate(async () => {
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = indexedDB.open("InertiaDB")

      request.addEventListener("success", () => {
        const db = request.result
        const tx = db.transaction("settings", "readonly")
        const store = tx.objectStore("settings")
        const getRequest = store.get("settings")

        getRequest.addEventListener("success", () => {
          resolve(getRequest.result ?? null)
        })
        getRequest.addEventListener("error", () => {
          reject(getRequest.error)
        })
      })

      request.addEventListener("error", () => reject(request.error))
      request.addEventListener("upgradeneeded", () => resolve(null))
    })

    if (typeof value !== "object" || value === null) return null
    const settings = value

    const id = Reflect.get(settings, "id")
    const restTimerDuration = Reflect.get(settings, "restTimerDuration")
    const unitPreferences = Reflect.get(settings, "unitPreferences")

    if (typeof id !== "string") return null
    if (typeof restTimerDuration !== "number") return null
    if (typeof unitPreferences !== "object" || unitPreferences === null) return null

    const weight = Reflect.get(unitPreferences, "weight")
    const distance = Reflect.get(unitPreferences, "distance")
    if (
      (weight !== "lbs" && weight !== "kg") ||
      (distance !== "mi" && distance !== "km")
    ) {
      return null
    }

    return {
      id,
      restTimerDuration,
      unitPreferences: {
        weight,
        distance,
      },
    }
  })
}
