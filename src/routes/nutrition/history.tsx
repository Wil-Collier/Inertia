import { createFileRoute } from "@tanstack/react-router"
import { NutritionHistoryPage } from "@/pages/NutritionHistoryPage"

export const Route = createFileRoute("/nutrition/history")({
  component: NutritionHistoryPage,
})
