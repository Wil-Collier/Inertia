import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Layout } from "@/components/layout/Layout"
import { PageErrorBoundary } from "@/components/PageErrorBoundary"

// Lazy load pages for code-splitting
const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })))
const WorkoutPage = lazy(() => import("@/pages/WorkoutPage").then((m) => ({ default: m.WorkoutPage })))
const ActiveWorkout = lazy(() => import("@/pages/ActiveWorkout").then((m) => ({ default: m.ActiveWorkout })))
const WorkoutHistory = lazy(() => import("@/pages/WorkoutHistory").then((m) => ({ default: m.WorkoutHistory })))
const WorkoutCalendar = lazy(() => import("@/pages/WorkoutCalendar").then((m) => ({ default: m.WorkoutCalendar })))
const WorkoutTemplates = lazy(() => import("@/pages/WorkoutTemplates").then((m) => ({ default: m.WorkoutTemplates })))
const NutritionPage = lazy(() => import("@/pages/NutritionPage").then((m) => ({ default: m.NutritionPage })))
const NutritionHistoryPage = lazy(() => import("@/pages/NutritionHistoryPage").then((m) => ({ default: m.NutritionHistoryPage })))
const ProgressPage = lazy(() => import("@/pages/ProgressPage").then((m) => ({ default: m.ProgressPage })))
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })))

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<PageErrorBoundary><Dashboard /></PageErrorBoundary>} />
            <Route path="/workout" element={<PageErrorBoundary><WorkoutPage /></PageErrorBoundary>} />
            <Route path="/workout/active" element={<PageErrorBoundary><ActiveWorkout /></PageErrorBoundary>} />
            <Route path="/workout/history" element={<PageErrorBoundary><WorkoutHistory /></PageErrorBoundary>} />
            <Route path="/workout/calendar" element={<PageErrorBoundary><WorkoutCalendar /></PageErrorBoundary>} />
            <Route path="/workout/templates" element={<PageErrorBoundary><WorkoutTemplates /></PageErrorBoundary>} />
            <Route path="/nutrition" element={<PageErrorBoundary><NutritionPage /></PageErrorBoundary>} />
            <Route path="/nutrition/history" element={<PageErrorBoundary><NutritionHistoryPage /></PageErrorBoundary>} />
            <Route path="/progress" element={<PageErrorBoundary><ProgressPage /></PageErrorBoundary>} />
            <Route path="/settings" element={<PageErrorBoundary><SettingsPage /></PageErrorBoundary>} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
