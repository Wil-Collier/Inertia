import { describe, expect, it } from "vitest"
import { calculateNutritionAverages, calculateNutritionTotals, INITIAL_TOTALS } from "@/lib/nutritionUtils"
import type { FoodItem } from "@/lib/types"

describe("nutritionUtils", () => {
  it("calculates totals with quantity multipliers and rounds precision", () => {
    const foodsById = new Map<string, FoodItem>([
      [
        "food-1",
        {
          id: "food-1",
          name: "Oats",
          calories: 150.4,
          protein: 5.55,
          carbs: 27.75,
          fat: 2.39,
          fiber: 4.24,
          sugar: 1.26,
          servingSize: "1 bowl",
          isCustom: true,
        },
      ],
    ])

    const totals = calculateNutritionTotals(
      [
        { foodId: "food-1", quantity: 2 },
        { foodId: "food-1", quantity: 0.5 },
      ],
      foodsById
    )

    expect(totals).toEqual({
      calories: 376,
      protein: 13.9,
      carbs: 69.4,
      fat: 6,
      fiber: 10.6,
      sugar: 3.2,
    })
  })

  it("ignores entries whose foods are missing", () => {
    const totals = calculateNutritionTotals([{ foodId: "missing", quantity: 3 }], new Map())
    expect(totals).toEqual(INITIAL_TOTALS)
  })

  it("calculates averages only across days with logged calories", () => {
    const averages = calculateNutritionAverages([
      { date: "2026-02-01", calories: 2000, protein: 160, carbs: 240, fat: 70, fiber: 30, sugar: 40 },
      { date: "2026-02-02", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
      { date: "2026-02-03", calories: 1800, protein: 140, carbs: 220, fat: 60, fiber: 25, sugar: 35 },
    ])

    expect(averages).toEqual({
      calories: 1900,
      protein: 150,
      carbs: 230,
      fat: 65,
      fiber: 28,
      sugar: 38,
    })
  })

  it("returns zeroed averages when no days have data", () => {
    expect(
      calculateNutritionAverages([
        { date: "2026-02-01", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
      ])
    ).toEqual(INITIAL_TOTALS)
  })
})
