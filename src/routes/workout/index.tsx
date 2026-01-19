import { createFileRoute } from "@tanstack/react-router"
import { WorkoutPage } from "@/pages/WorkoutPage"

export const Route = createFileRoute("/workout/")({
  component: WorkoutPage,
})
