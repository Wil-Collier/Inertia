import { createFileRoute, redirect } from "@tanstack/react-router"
import { ActiveWorkout } from "@/pages/ActiveWorkout"
import { db } from "@/services/db"

export const Route = createFileRoute("/workout/active")({
  beforeLoad: async () => {
    const session = await db.activeSession.get("current")

    if (!session) {
      throw redirect({ to: "/workout" })
    }
  },
  component: ActiveWorkout,
})
