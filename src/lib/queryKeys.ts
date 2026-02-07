import { ACTIVE_SESSION_ID } from "@/lib/constants"

export const queryKeys = {
  // Workouts
  workouts: {
    all: ["workouts"] as const,
    list: (limit?: number) => [...queryKeys.workouts.all, "list", { limit }] as const,
    detail: (id: string) => [...queryKeys.workouts.all, "detail", id] as const,
    byDate: (date: string) => [...queryKeys.workouts.all, "date", date] as const,
    byExercise: (exerciseId: string) => [...queryKeys.workouts.all, "exercise", exerciseId] as const,
  },
  
  // Templates
  templates: {
    all: ["templates"] as const,
    list: () => [...queryKeys.templates.all, "list"] as const,
    detail: (id: string) => [...queryKeys.templates.all, "detail", id] as const,
  },
  
  // Exercises
  exercises: {
    all: ["exercises"] as const,
    list: () => [...queryKeys.exercises.all, "list"] as const,
    detail: (id: string) => [...queryKeys.exercises.all, "detail", id] as const,
    byIds: (ids: string[]) => [...queryKeys.exercises.all, "byIds", ids] as const,
    byMuscle: (muscle: string) => [...queryKeys.exercises.all, "muscle", muscle] as const,
  },
  
  // Nutrition
  nutrition: {
    all: ["nutrition"] as const,
    daily: (date: string) => [...queryKeys.nutrition.all, "daily", date] as const,
    range: (start: string, end: string) => [...queryKeys.nutrition.all, "range", start, end] as const,
  },
  
  // Foods
  foods: {
    all: ["foods"] as const,
    list: () => [...queryKeys.foods.all, "list"] as const,
    search: (query: string) => [...queryKeys.foods.all, "search", query] as const,
    combinedSearch: (query: string) => [...queryKeys.foods.all, "combinedSearch", query] as const,
    favorites: () => [...queryKeys.foods.all, "favorites"] as const,
    detail: (id: string) => [...queryKeys.foods.all, "detail", id] as const,
  },
  
  // Body Weight
  bodyWeight: {
    all: ["bodyWeight"] as const,
    list: (limit?: number) => [...queryKeys.bodyWeight.all, "list", { limit }] as const,
    latest: () => [...queryKeys.bodyWeight.all, "latest"] as const,
  },
  
  // Settings
  settings: {
    all: ["settings"] as const,
  },
  
  // Achievements
  achievements: {
    all: ["achievements"] as const,
  },
  
  // Active Session (special - ephemeral)
  activeSession: {
    current: ["activeSession", ACTIVE_SESSION_ID] as const,
  },
} as const
