import { createFileRoute } from "@tanstack/react-router"
import { WorkoutTemplates } from "@/pages/WorkoutTemplates"

export const Route = createFileRoute("/workout/templates")({
  component: WorkoutTemplates,
})
