import { createFileRoute, redirect } from "@tanstack/react-router"
import { ActiveWorkout } from "@/pages/ActiveWorkout"
import { useActiveSessionStore } from "@/features/workout/activeSessionStore"

export const Route = createFileRoute("/workout/active")({
  beforeLoad: async () => {
    const store = useActiveSessionStore.getState()
    await store.init()

    if (!store.session) {
      throw redirect({ to: "/workout" })
    }
  },
  component: ActiveWorkout,
})
