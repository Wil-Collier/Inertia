import { describe, expect, it } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useNavigate } from "@tanstack/react-router"
import { renderAppRoute } from "@/test/helpers/renderAppRoute"

function HomeRoute() {
  const navigate = useNavigate()

  return (
    <div>
      <h1>Home</h1>
      <button type="button" onClick={() => void navigate({ to: "/workout" })}>
        Go to workout
      </button>
    </div>
  )
}

function WorkoutRoute() {
  return <h1>Workout</h1>
}

describe("renderAppRoute", () => {
  it("renders initial route and navigates using router state", async () => {
    const user = userEvent.setup()

    const { router } = await renderAppRoute({
      initialPath: "/",
      routes: [
        { path: "/", component: HomeRoute },
        { path: "/workout", component: WorkoutRoute },
      ],
    })

    expect(screen.getByText("Home")).toBeTruthy()
    expect(router.state.location.pathname).toBe("/")

    await user.click(screen.getByRole("button", { name: "Go to workout" }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/workout")
      expect(screen.getByText("Workout")).toBeTruthy()
    })
  })

  it("uses fallback view for unknown paths", async () => {
    await renderAppRoute({
      initialPath: "/missing",
      routes: [{ path: "/", component: HomeRoute }],
    })

    expect(screen.getByTestId("route-not-found")).toBeTruthy()
  })
})
