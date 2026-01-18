import { Link } from "react-router-dom"
import { useMemo } from "react"
import { format } from "date-fns"
import { Dumbbell, Utensils, Clock, Flame, Target, Trophy, Plus, ChevronRight } from "lucide-react"

import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { useWorkoutStore } from "@/stores/workout"
import { getTodayDate } from "@/stores/nutritionStore"
import { useDailyNutrition, useNutritionDatesDB } from "@/hooks/db/useNutritionDB"
import { useWorkoutsDB, useWorkoutDatesDB } from "@/hooks/db/useWorkoutsDB"
import { useSettingsStore } from "@/stores/settingsStore"
import { useAchievementsStore } from "@/stores/achievementsStore"
import { WeeklyConsistency } from "@/components/dashboard/WeeklyConsistency"
import { WeightCard } from "@/components/dashboard/WeightCard"
import { achievements } from "@/data/achievements"
import { cn } from "@/lib/utils"

export function Dashboard() {
  const today = getTodayDate()
  const todayFormatted = format(new Date(), "EEEE, MMMM d")

  const activeSession = useWorkoutStore((s) => s.activeSession)
  const { totals } = useDailyNutrition(today)
  const { data: todayWorkouts, isLoading: isWorkoutsLoading } = useWorkoutsDB(today)
  const nutritionGoals = useSettingsStore((s) => s.settings.nutritionGoals)
  const { unlockedAchievements } = useAchievementsStore()

  const calorieGoal = nutritionGoals.calories
  const currentCalories = totals?.calories ?? 0
  const caloriesRemaining = Math.max(0, calorieGoal - currentCalories)
  const calorieProgress = Math.min(100, (currentCalories / calorieGoal) * 100)

  // For WeeklyConsistency, we need ALL workout dates and logged nutrition dates.
  const workoutDates = useWorkoutDatesDB()
  const nutritionDates = useNutritionDatesDB()

  // Recent achievements
  const recentAchievements = useMemo(() => {
    return unlockedAchievements
      .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
      .slice(0, 2)
      .map(ua => achievements.find(a => a.id === ua.id))
      .filter((a): a is typeof achievements[0] => !!a)
  }, [unlockedAchievements])

  return (
    <div className="flex flex-col pb-20">
      <Header
        title="Dashboard"
        rightAction={
          <span className="text-xs text-muted-foreground font-medium">
            {todayFormatted}
          </span>
        }
      />

      <div className="space-y-4 p-4">
        {/* Active Workout Banner */}
        {activeSession && (
          <Link to="/workout/active" className="block animate-in fade-in slide-in-from-top-4 duration-500">
            <Card className="border-primary bg-primary/5 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <CardContent className="flex items-center gap-3 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  <Dumbbell className="h-6 w-6 animate-pulse" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-primary">Workout in Progress</p>
                  <p className="text-sm text-muted-foreground font-medium">
                    {activeSession.workout.name}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-primary/50" />
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Weekly Activity */}
        <WeeklyConsistency 
          workoutDates={workoutDates} 
          nutritionDates={nutritionDates} 
        />

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Link to={activeSession ? "/workout/active" : "/workout"}>
            <Card className="h-full transition-all hover:scale-[1.02] active:scale-[0.98] border-none bg-primary text-primary-foreground shadow-md">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <span className="font-bold text-sm leading-tight">
                  {activeSession ? "Continue" : "Start"} Workout
                </span>
              </CardContent>
            </Card>
          </Link>

          <Link to="/nutrition">
            <Card className="h-full transition-all hover:scale-[1.02] active:scale-[0.98] border-none bg-category-nutrition text-white shadow-md">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Plus className="h-5 w-5" />
                </div>
                <span className="font-bold text-sm leading-tight">Log Meal</span>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Nutrition Overview */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Flame className="h-5 w-5 text-category-nutrition" />
              Nutrition
            </CardTitle>
            <Link to="/nutrition" className="text-xs text-primary font-bold flex items-center gap-1">
              Details <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-4xl font-black tracking-tight">{Math.round(caloriesRemaining)}</p>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Calories Left
                </p>
              </div>
              <div className="relative h-20 w-20">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90 drop-shadow-sm">
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-muted"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray={`${calorieProgress} 100`}
                    strokeLinecap="round"
                    className="text-category-nutrition transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Utensils className="h-6 w-6 text-category-nutrition/50" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <CompactMacro 
                label="Protein" 
                value={totals?.protein ?? 0} 
                goal={nutritionGoals.protein} 
                color="bg-macro-protein" 
              />
              <CompactMacro 
                label="Carbs" 
                value={totals?.carbs ?? 0} 
                goal={nutritionGoals.carbs} 
                color="bg-macro-carbs" 
              />
              <CompactMacro 
                label="Fat" 
                value={totals?.fat ?? 0} 
                goal={nutritionGoals.fat} 
                color="bg-macro-fat" 
              />
            </div>
          </CardContent>
        </Card>

        {/* Body Weight */}
        <WeightCard />

        {/* Recent Achievements */}
        {recentAchievements.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Recent Wins
              </h3>
              <Link to="/progress" className="text-xs text-primary font-bold">
                View All
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {recentAchievements.map((achievement) => (
                <Card key={achievement.id} className="bg-yellow-500/5 border-yellow-500/20">
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500 text-white shadow-sm">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{achievement.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {achievement.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Today's Workouts */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Target className="h-5 w-5 text-primary" />
              Today's Workouts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {isWorkoutsLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading today's workouts...
              </div>
            ) : todayWorkouts.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Dumbbell className="h-6 w-6" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  No workouts logged yet today
                </p>
                <Link 
                  to="/workout" 
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Choose a template
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {todayWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Dumbbell className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{workout.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
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
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
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

function CompactMacro({
  label,
  value,
  goal,
  color,
}: {
  label: string
  value: number
  goal: number
  color: string
}) {
  const percentage = goal > 0 ? Math.min((value / goal) * 100, 100) : 0

  return (
    <div className="space-y-1.5">
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-sm font-black">
          {Math.round(value)}g
        </span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-1000", color)} 
          style={{ width: `${percentage}%` }} 
        />
      </div>
    </div>
  )
}
