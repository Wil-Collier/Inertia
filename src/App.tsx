import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Layout } from "@/components/layout/Layout"
import { PageErrorBoundary } from "@/components/PageErrorBoundary"
import { PageLoader } from "@/components/ui/PageLoader"
import { AppInitializer } from "@/components/AppInitializer"

// Lazy load pages for code-splitting
const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })))
const WorkoutPage = lazy(() => import("@/pages/WorkoutPage").then((m) => ({ default: m.WorkoutPage })))
const ActiveWorkout = lazy(() => import("@/pages/ActiveWorkout").then((m) => ({ default: m.ActiveWorkout })))
const WorkoutHistory = lazy(() => import("@/pages/WorkoutHistory").then((m) => ({ default: m.WorkoutHistory })))
const WorkoutTemplates = lazy(() => import("@/pages/WorkoutTemplates").then((m) => ({ default: m.WorkoutTemplates })))
const NutritionPage = lazy(() => import("@/pages/NutritionPage").then((m) => ({ default: m.NutritionPage })))
const NutritionHistoryPage = lazy(() => import("@/pages/NutritionHistoryPage").then((m) => ({ default: m.NutritionHistoryPage })))
const ProgressPage = lazy(() => import("@/pages/ProgressPage").then((m) => ({ default: m.ProgressPage })))
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })))

export function App() {
  return (
    <BrowserRouter>
      <AppInitializer>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<PageErrorBoundary><Dashboard /></PageErrorBoundary>} />
              <Route path="/workout" element={<PageErrorBoundary><WorkoutPage /></PageErrorBoundary>} />
              <Route path="/workout/active" element={<PageErrorBoundary><ActiveWorkout /></PageErrorBoundary>} />
              <Route path="/workout/history" element={<PageErrorBoundary><WorkoutHistory /></PageErrorBoundary>} />
              <Route path="/workout/templates" element={<PageErrorBoundary><WorkoutTemplates /></PageErrorBoundary>} />
              <Route path="/nutrition" element={<PageErrorBoundary><NutritionPage /></PageErrorBoundary>} />
              <Route path="/nutrition/history" element={<PageErrorBoundary><NutritionHistoryPage /></PageErrorBoundary>} />
              <Route path="/progress" element={<PageErrorBoundary><ProgressPage /></PageErrorBoundary>} />
              <Route path="/settings" element={<PageErrorBoundary><SettingsPage /></PageErrorBoundary>} />
            </Route>
          </Routes>
        </Suspense>
      </AppInitializer>
    </BrowserRouter>
  )
}

export default App
