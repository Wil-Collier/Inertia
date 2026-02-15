import type {
  DailyNutrition,
  FoodItem,
  MealTemplate,
  MealTemplateEntry,
  MealType,
  NutritionMealEntry,
} from "@/lib/types"

let nutritionCounter = 0

function nextNutritionId(prefix: string): string {
  nutritionCounter += 1
  return `${prefix}-${nutritionCounter}`
}

export function createFoodItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: overrides.id ?? nextNutritionId("food"),
    name: overrides.name ?? "Chicken Breast",
    brand: overrides.brand,
    calories: overrides.calories ?? 165,
    protein: overrides.protein ?? 31,
    carbs: overrides.carbs ?? 0,
    fat: overrides.fat ?? 3,
    fiber: overrides.fiber ?? 0,
    sugar: overrides.sugar ?? 0,
    servingSize: overrides.servingSize ?? "100g",
    servingGrams: overrides.servingGrams,
    barcode: overrides.barcode,
    isCustom: overrides.isCustom ?? true,
    isFavorite: overrides.isFavorite ?? false,
    usageCount: overrides.usageCount,
    updatedAt: overrides.updatedAt,
  }
}

export function createRemoteFood(overrides: Partial<FoodItem> = {}): FoodItem {
  return createFoodItem({
    isCustom: false,
    ...overrides,
  })
}

export function createCustomFood(overrides: Partial<FoodItem> = {}): FoodItem {
  return createFoodItem({
    isCustom: true,
    ...overrides,
  })
}

export function createMealEntry(overrides: Partial<NutritionMealEntry> = {}): NutritionMealEntry {
  return {
    id: overrides.id ?? nextNutritionId("entry"),
    foodId: overrides.foodId ?? nextNutritionId("food-ref"),
    quantity: overrides.quantity ?? 1,
    mealType: overrides.mealType ?? "breakfast",
    updatedAt: overrides.updatedAt ?? Date.now(),
    deletedAt: overrides.deletedAt,
    templateId: overrides.templateId,
    templateInstanceId: overrides.templateInstanceId,
    templateName: overrides.templateName,
  }
}

export function createMealTemplateEntry(overrides: Partial<MealTemplateEntry> = {}): MealTemplateEntry {
  return {
    foodId: overrides.foodId ?? nextNutritionId("food-ref"),
    quantity: overrides.quantity ?? 1,
    mealType: overrides.mealType ?? "breakfast",
    templateId: overrides.templateId,
  }
}

export function createDailyNutritionLog(overrides: Partial<DailyNutrition> = {}): DailyNutrition {
  return {
    date: overrides.date ?? "2026-02-09",
    entries: overrides.entries ?? [createMealEntry()],
    updatedAt: overrides.updatedAt,
  }
}

export function createMealTemplate(
  overrides: Partial<MealTemplate> & { mealType?: MealType } = {}
): MealTemplate {
  const mealType = overrides.mealType ?? "breakfast"

  return {
    id: overrides.id ?? nextNutritionId("meal-template"),
    name: overrides.name ?? "Default Meal",
    entries: overrides.entries ?? [createMealTemplateEntry({ mealType })],
    updatedAt: overrides.updatedAt,
  }
}

export function resetNutritionFactory(): void {
  nutritionCounter = 0
}
