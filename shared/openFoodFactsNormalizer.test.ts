import { describe, expect, it } from "vitest"
import { normalizeOpenFoodFactsProduct } from "./openFoodFactsNormalizer"
import type { OpenFoodFactsProductLike } from "./openFoodFactsNormalizer"

describe("normalizeOpenFoodFactsProduct", () => {
  it("returns null when product_name is missing", () => {
    expect(normalizeOpenFoodFactsProduct({})).toBeNull()
    expect(normalizeOpenFoodFactsProduct({ code: "1234", brands: "ACME" })).toBeNull()
  })

  it("returns a normalized food with basic nutriments per 100g", () => {
    const product: OpenFoodFactsProductLike = {
      code: "0012345678901",
      product_name: "Plain Oats",
      brands: "Quaker",
      nutriments: {
        "energy-kcal_100g": 370,
        proteins_100g: 13,
        carbohydrates_100g: 66,
        fat_100g: 7,
        fiber_100g: 10,
        sugars_100g: 1,
      },
      serving_size: "40g",
      serving_quantity: 40,
    }

    const result = normalizeOpenFoodFactsProduct(product)

    expect(result).not.toBeNull()
    expect(result!.id).toBe("0012345678901")
    expect(result!.name).toBe("Plain Oats")
    expect(result!.brand).toBe("Quaker")
    expect(result!.barcode).toBe("0012345678901")
    expect(result!.isCustom).toBe(false)
    // 40g serving → scale = 0.4
    expect(result!.calories).toBe(148)  // 370 * 0.4 = 148
    expect(result!.protein).toBe(5.2)   // 13 * 0.4 = 5.2
    expect(result!.carbs).toBe(26.4)    // 66 * 0.4 = 26.4
    expect(result!.fat).toBe(2.8)       // 7 * 0.4 = 2.8
    expect(result!.fiber).toBe(4)       // 10 * 0.4 = 4.0
    expect(result!.sugar).toBe(0.4)     // 1 * 0.4 = 0.4
    expect(result!.servingSize).toBe("40g")
    expect(result!.servingGrams).toBe(40)
  })

  it("prefers _serving nutrient fields over _100g when both are present", () => {
    const product: OpenFoodFactsProductLike = {
      product_name: "Banana",
      nutriments: {
        "energy-kcal_serving": 89,
        "energy-kcal_100g": 100,
        proteins_serving: 1.1,
        proteins_100g: 1.3,
        carbohydrates_serving: 23,
        carbohydrates_100g: 25,
        fat_serving: 0.3,
        fat_100g: 0.4,
        fiber_serving: 2.6,
        fiber_100g: 3,
        sugars_serving: 12,
        sugars_100g: 14,
      },
      serving_quantity: 118,
    }

    const result = normalizeOpenFoodFactsProduct(product)

    expect(result).not.toBeNull()
    expect(result!.calories).toBe(89)
    expect(result!.protein).toBe(1.1)
    expect(result!.carbs).toBe(23)
    expect(result!.fat).toBe(0.3)
    expect(result!.fiber).toBe(2.6)
    expect(result!.sugar).toBe(12)
  })

  it("falls back to 100g baseline (scale 1) when no serving_quantity is provided", () => {
    const product: OpenFoodFactsProductLike = {
      product_name: "White Rice",
      nutriments: {
        "energy-kcal_100g": 360,
        proteins_100g: 7,
        carbohydrates_100g: 79,
        fat_100g: 0.6,
      },
    }

    const result = normalizeOpenFoodFactsProduct(product)

    expect(result).not.toBeNull()
    expect(result!.calories).toBe(360)
    expect(result!.protein).toBe(7)
    expect(result!.carbs).toBe(79)
    expect(result!.fat).toBe(0.6)
    expect(result!.servingSize).toBe("100g")
    expect(result!.servingGrams).toBe(100)
  })

  it("uses explicit serving_size string for label when present", () => {
    const product: OpenFoodFactsProductLike = {
      product_name: "Greek Yogurt",
      nutriments: {
        "energy-kcal_serving": 100,
      },
      serving_size: "1 container (150g)",
      serving_quantity: 150,
    }

    const result = normalizeOpenFoodFactsProduct(product)

    expect(result).not.toBeNull()
    expect(result!.servingSize).toBe("1 container (150g)")
    expect(result!.servingGrams).toBe(150)
  })

  it("uses '1 serving' label when serving data is present but no explicit serving_size", () => {
    const product: OpenFoodFactsProductLike = {
      product_name: "Protein Bar",
      nutriments: {
        "energy-kcal_serving": 200,
        proteins_serving: 20,
        carbohydrates_serving: 25,
        fat_serving: 6,
      },
    }

    const result = normalizeOpenFoodFactsProduct(product)

    expect(result).not.toBeNull()
    expect(result!.servingSize).toBe("1 serving")
    expect(result!.servingGrams).toBeUndefined()
  })

  it("parses serving_quantity as a string number", () => {
    const product: OpenFoodFactsProductLike = {
      product_name: "Almond Milk",
      nutriments: {
        "energy-kcal_100g": 15,
        proteins_100g: 0.4,
        carbohydrates_100g: 0.3,
        fat_100g: 1.1,
      },
      serving_quantity: "240",
    }

    const result = normalizeOpenFoodFactsProduct(product)

    expect(result).not.toBeNull()
    // 240g serving → scale = 2.4
    expect(result!.calories).toBe(36)   // 15 * 2.4 = 36
    expect(result!.servingGrams).toBe(240)
  })

  it("ignores invalid (non-numeric) serving_quantity and falls back to 100g scale", () => {
    const product: OpenFoodFactsProductLike = {
      product_name: "Mystery Bar",
      nutriments: {
        "energy-kcal_100g": 400,
      },
      // serving_quantity is typed as number | string; a non-numeric string should be treated as absent
      serving_quantity: "n/a",
    }

    const result = normalizeOpenFoodFactsProduct(product)

    expect(result).not.toBeNull()
    expect(result!.calories).toBe(400)
  })

  it("generates a UUID id when product code is missing", () => {
    const product: OpenFoodFactsProductLike = {
      product_name: "House Brand Cracker",
      nutriments: { "energy-kcal_100g": 450 },
    }

    const result = normalizeOpenFoodFactsProduct(product)

    expect(result).not.toBeNull()
    expect(result!.id).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
    )
    expect(result!.barcode).toBeUndefined()
  })

  it("returns zero for missing nutriment fields", () => {
    const product: OpenFoodFactsProductLike = {
      product_name: "Water",
      nutriments: {},
    }

    const result = normalizeOpenFoodFactsProduct(product)

    expect(result).not.toBeNull()
    expect(result!.calories).toBe(0)
    expect(result!.protein).toBe(0)
    expect(result!.carbs).toBe(0)
    expect(result!.fat).toBe(0)
    expect(result!.fiber).toBe(0)
    expect(result!.sugar).toBe(0)
  })

  it("mixes per-field serving and 100g fallback independently", () => {
    // Only calories has a _serving value; other fields must fall back to _100g with scale
    const product: OpenFoodFactsProductLike = {
      product_name: "Mixed Nuts",
      nutriments: {
        "energy-kcal_serving": 170,
        proteins_100g: 15,
        carbohydrates_100g: 10,
        fat_100g: 50,
      },
      serving_quantity: 28,
    }

    const result = normalizeOpenFoodFactsProduct(product)

    expect(result).not.toBeNull()
    expect(result!.calories).toBe(170)         // direct serving value
    // scale = 28/100 = 0.28
    expect(result!.protein).toBe(4.2)          // 15 * 0.28 = 4.2
    expect(result!.carbs).toBe(2.8)            // 10 * 0.28 = 2.8
    expect(result!.fat).toBe(14)               // 50 * 0.28 = 14.0
    expect(result!.servingSize).toBe("1 serving")
  })
})
