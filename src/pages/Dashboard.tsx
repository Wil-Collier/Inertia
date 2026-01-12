import { Link } from "react-router-dom"
import { format } from "date-fns"
import { Dumbbell, Utensils, Clock, Flame, Target } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { StreakBadge } from "@/components/StreakDisplay"
import { useWorkoutStore } from "@/stores/workoutStore"
import { useNutritionStore, getTodayDate } from "@/stores/nutritionStore"
import { useSettingsStore } from "@/stores/settingsStore"

export function Dashboard() {
  const today = getTodayDate()
  const todayFormatted = format(new Date(), "EEEE, MMMM d")

  const { workouts, activeSession } = useWorkoutStore()
  const { getDailyTotals, getProgressToGoals } = useNutritionStore()
  const { settings } = useSettingsStore()
  const todayWorkouts = workouts.filter((w) => w.date === today)
  const totals = getDailyTotals(today)
  const progress = getProgressToGoals(today, settings.nutritionGoals)

  return (
    <div className="flex flex-col">
      <Header title="Dashboard" />

      <div className="space-y-4 p-4">
        {/* Date display with streak */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{todayFormatted}</p>
          <StreakBadge />
        </div>

        {/* Active Workout Banner */}
        {activeSession && (
          <Link to="/workout/active" className="block">
            <Card className="border-primary bg-primary/5">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Workout in Progress</p>
                  <p className="text-sm text-muted-foreground">
                    {activeSession.workout.name} -{" "}
                    {activeSession.workout.exercises.length} exercises
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link to={activeSession ? "/workout/active" : "/workout"}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Dumbbell className="h-6 w-6" />
                </div>
                <span className="font-medium">
                  {activeSession ? "Continue Workout" : "Start Workout"}
                </span>
              </CardContent>
            </Card>
          </Link>

          <Link to="/nutrition">
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                  <Utensils className="h-6 w-6" />
                </div>
                <span className="font-medium">Log Meal</span>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Nutrition Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-orange-500" />
              Today's Nutrition
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{Math.round(totals.calories)}</p>
                <p className="text-sm text-muted-foreground">
                  of {settings.nutritionGoals.calories} kcal
                </p>
              </div>
              <div className="h-16 w-16">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-muted"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${Math.min(progress.calories, 100)} 100`}
                    strokeLinecap="round"
                    className="text-primary"
                  />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <MacroProgress
                label="Protein"
                value={totals.protein}
                goal={settings.nutritionGoals.protein}
                unit="g"
                color="bg-blue-500"
              />
              <MacroProgress
                label="Carbs"
                value={totals.carbs}
                goal={settings.nutritionGoals.carbs}
                unit="g"
                color="bg-green-500"
              />
              <MacroProgress
                label="Fat"
                value={totals.fat}
                goal={settings.nutritionGoals.fat}
                unit="g"
                color="bg-yellow-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <MacroProgress
                label="Fiber"
                value={totals.fiber}
                goal={settings.nutritionGoals.fiber}
                unit="g"
                color="bg-emerald-500"
              />
              <MacroProgress
                label="Sugar"
                value={totals.sugar}
                goal={settings.nutritionGoals.sugar}
                unit="g"
                color="bg-pink-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Today's Workouts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              Today's Workouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayWorkouts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No workouts completed today
              </p>
            ) : (
              <div className="space-y-3">
                {todayWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Dumbbell className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{workout.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{workout.exercises.length} exercises</span>
                        {workout.duration && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {workout.duration} min
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MacroProgress({
  label,
  value,
  goal,
  unit,
  color,
}: {
  label: string
  value: number
  goal: number
  unit: string
  color: string
}) {
  const percentage = goal > 0 ? Math.min((value / goal) * 100, 100) : 0

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {Math.round(value)}/{goal}
          {unit}
        </span>
      </div>
      <Progress value={percentage} className={`h-2 [&>div]:${color}`} />
    </div>
  )
}
