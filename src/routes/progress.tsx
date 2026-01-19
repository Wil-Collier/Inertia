import { createFileRoute } from "@tanstack/react-router"
import { ProgressPage } from "@/pages/ProgressPage"

export const Route = createFileRoute("/progress")({
  component: ProgressPage,
})
