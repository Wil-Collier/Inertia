import { createFileRoute, redirect } from "@tanstack/react-router"
import { ActiveWorkout } from "@/pages/ActiveWorkout"
import { activeSessionService } from "@/features/workout/services/activeSessionService"

export const Route = createFileRoute("/workout/active")({
  beforeLoad: async () => {
    const hasSession = await activeSessionService.hasActiveSession()

    if (!hasSession) {
      throw redirect({ to: "/workout" })
    }
  },
  component: ActiveWorkout,
})
