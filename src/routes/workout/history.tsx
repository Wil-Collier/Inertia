import { createFileRoute } from "@tanstack/react-router"
import { WorkoutHistory } from "@/pages/WorkoutHistory"

export const Route = createFileRoute("/workout/history")({
  component: WorkoutHistory,
})
