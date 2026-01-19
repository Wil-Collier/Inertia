import { createFileRoute } from "@tanstack/react-router"
import { NutritionPage } from "@/pages/NutritionPage"
import { z } from "zod"

const nutritionSearchSchema = z.object({
  date: z.string().optional(),
})

export const Route = createFileRoute("/nutrition/")({
  validateSearch: nutritionSearchSchema,
  component: NutritionPage,
})
