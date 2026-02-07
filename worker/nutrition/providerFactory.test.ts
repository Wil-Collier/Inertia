import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Env } from "../env"

const createOpenFoodFactsProviderMock = vi.fn()
const createFatSecretProviderMock = vi.fn()

vi.mock("./openFoodFacts", () => ({
  createOpenFoodFactsProvider: (...args: unknown[]) => createOpenFoodFactsProviderMock(...args),
}))

vi.mock("./fatSecret", () => ({
  createFatSecretProvider: (...args: unknown[]) => createFatSecretProviderMock(...args),
}))

async function loadFactory() {
  return await import("./providerFactory")
}

function createUnusedDb(): Env["DB"] {
  return {
    prepare: () => {
      throw new Error("DB is not used in this test")
    },
    batch: async () => {
      throw new Error("DB is not used in this test")
    },
    exec: async () => {
      throw new Error("DB is not used in this test")
    },
    withSession: () => {
      throw new Error("DB is not used in this test")
    },
    dump: async () => {
      throw new Error("DB is not used in this test")
    },
  }
}

describe("nutrition providerFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createOpenFoodFactsProviderMock.mockReturnValue({
      search: vi.fn(),
      lookupBarcode: vi.fn(),
    })
    createFatSecretProviderMock.mockReturnValue({
      search: vi.fn(),
      lookupBarcode: vi.fn(),
    })
  })

  it("returns OpenFoodFacts provider by default", async () => {
    const { getProvider } = await loadFactory()

    const result = getProvider({
      DB: createUnusedDb(),
      JWT_SECRET: "secret",
      GOOGLE_CLIENT_ID: "google-id",
    })

    expect(result.name).toBe("openfoodfacts")
    expect(createOpenFoodFactsProviderMock).toHaveBeenCalledTimes(1)
    expect(createFatSecretProviderMock).not.toHaveBeenCalled()
  })

  it("returns FatSecret provider when configured", async () => {
    const { getProvider } = await loadFactory()

    const env = {
      DB: createUnusedDb(),
      JWT_SECRET: "secret",
      GOOGLE_CLIENT_ID: "google-id",
      NUTRITION_PROVIDER: "fatsecret" as const,
      FAT_SECRET_CLIENT_ID: "client",
      FAT_SECRET_CLIENT_SECRET: "secret-value",
    }

    const result = getProvider(env)

    expect(result.name).toBe("fatsecret")
    expect(createFatSecretProviderMock).toHaveBeenCalledWith(env)
    expect(createOpenFoodFactsProviderMock).not.toHaveBeenCalled()
  })

  it("throws when fatsecret is selected without credentials", async () => {
    const { getProvider } = await loadFactory()

    expect(() =>
      getProvider({
        DB: createUnusedDb(),
        JWT_SECRET: "secret",
        GOOGLE_CLIENT_ID: "google-id",
        NUTRITION_PROVIDER: "fatsecret",
      })
    ).toThrow("FatSecret provider requires FAT_SECRET_CLIENT_ID and FAT_SECRET_CLIENT_SECRET")
  })
})
