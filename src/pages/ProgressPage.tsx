import { useMemo, useState, useCallback } from "react"
import { startOfWeek, subWeeks, format } from "date-fns"
import { Trophy, TrendingUp, Dumbbell, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { ValueType } from "recharts/types/component/DefaultTooltipContent"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AchievementBadge } from "@/components/AchievementBadge"
import { useExercises, useExercisesByIds } from "@/features/exercises/queries"
import { useBodyWeightHistory } from "@/features/bodyweight/queries"
import { useAddWeightEntry, useDeleteWeightEntry } from "@/features/bodyweight/mutations"
import { useWorkoutStats, usePersonalRecords, useExerciseHistory, useProgressStats } from "@/features/workout/queries"
import { calculateOneRepMax, calculateSetVolume } from "@/lib/workoutUtils"
import { getNinetyDaysAgo, getToday, parseDbDate } from "@/lib/dateUtils"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { CHART_HEIGHTS, CHART_AXIS_STYLE, CHART_TOOLTIP_STYLE } from "@/lib/chartConfig"
import type { PersonalRecord } from "@/lib/types"

// Internal Components
import { StatCard } from "@/components/progress/StatCard"
import { BodyWeightTab } from "@/components/progress/BodyWeightTab"
import { ExerciseProgressTab } from "@/components/progress/ExerciseProgressTab"
import { MuscleBalanceTab } from "@/components/progress/MuscleBalanceTab"
import { AchievementsTab } from "@/components/progress/AchievementsTab"

// Chart Configuration Constants
const CHART_MARGIN = { top: 5, right: 5, left: 5, bottom: 5 }
const LINE_DOT_CONFIG = { fill: "var(--primary)" }

export function ProgressPage() {
  // 1. Efficient Stats
  const { data: stats = { totalWorkouts: 0, last30Days: 0, totalVolume: 0, prsCount: 0 } } = useProgressStats()

  // 2. Fetch data for charts (last 90 days is enough for both weekly chart and max muscle balance range)
  const ninetyDaysAgo = useMemo(() => getNinetyDaysAgo(), [])
  const todayStr = useMemo(() => getToday(), [])

  const { data: statsData } = useWorkoutStats(ninetyDaysAgo, todayStr)
  const recentWorkouts = useMemo(() => statsData?.workouts ?? [], [statsData?.workouts])

  const { data: personalRecords = {} as Record<string, PersonalRecord> } = usePersonalRecords()

  const { data: exercises = [] } = useExercises()
  // Resolve exercise names for PRs
  const prExerciseIds = useMemo(() => Object.keys(personalRecords), [personalRecords])
  const { data: prExerciseMap = new Map() } = useExercisesByIds(prExerciseIds)

  const addWeightEntryMutation = useAddWeightEntry()
  const deleteWeightEntryMutation = useDeleteWeightEntry()

  const { data: weightEntries = [] } = useBodyWeightHistory()

  const weightUnit = useWeightUnit()

  const [newWeight, setNewWeight] = useState("")
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)

  // Custom hook for exercise history if selected
  const { data: selectedExerciseHistory = [] } = useExerciseHistory(selectedExerciseId || "")



  // Calculate weekly volume data - optimized with O(N) pre-grouping
  const weeklyData = useMemo(() => {
    const today = new Date()

    // Pre-group workouts by week key in a single pass (O(N))
    const workoutsByWeek = new Map<string, typeof recentWorkouts>()
    for (const workout of recentWorkouts) {
      const workoutDate = parseDbDate(workout.date)
      const weekStart = startOfWeek(workoutDate)
      const weekKey = format(weekStart, "yyyy-MM-dd")

      const existing = workoutsByWeek.get(weekKey) ?? []
      existing.push(workout)
      workoutsByWeek.set(weekKey, existing)
    }

    // Build the 8-week array
    const weeks: { week: string; volume: number; workouts: number }[] = []
    for (let i = 7; i >= 0; i--) {
      const referenceDate = subWeeks(today, i)
      const weekStart = startOfWeek(referenceDate)
      const weekKey = format(weekStart, "yyyy-MM-dd")

      const weekWorkouts = workoutsByWeek.get(weekKey) ?? []

      const volume = weekWorkouts.reduce((total, workout) => {
        return (
          total +
          workout.exercises.reduce((exTotal, ex) => {
            return exTotal + calculateSetVolume(ex.sets)
          }, 0)
        )
      }, 0)

      weeks.push({
        week: format(weekStart, "MMM d"),
        volume: Math.round(volume),
        workouts: weekWorkouts.length,
      })
    }

    return weeks
  }, [recentWorkouts])

  // Get sorted personal records
  const sortedPRs = useMemo(() => {
    return Object.values(personalRecords)
      .map((pr) => ({
        ...pr,
        exercise: prExerciseMap.get(pr.exerciseId),
        oneRepMax: calculateOneRepMax(pr.weight, pr.reps),
      }))
      .filter((pr) => pr.exercise)
      .toSorted((a, b) => parseDbDate(b.date).getTime() - parseDbDate(a.date).getTime())
  }, [personalRecords, prExerciseMap])

  // Chart formatters
  const volumeTickFormatter = useCallback((value: number) => `${(value / 1000).toFixed(0)}k`, [])
  const volumeTooltipFormatter = useCallback((value: ValueType | undefined) => [`${Number(value ?? 0).toLocaleString()} ${weightUnit.unitLabel}`, "Volume"] as [string, string], [weightUnit.unitLabel])

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))]">
      <Header title="Progress" />

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 p-4 pb-20">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Dumbbell}
            label="Total Workouts"
            value={stats.totalWorkouts}
          />
          <StatCard
            icon={Calendar}
            label="Last 30 Days"
            value={stats.last30Days}
          />
          <StatCard
            icon={TrendingUp}
            label="Total Volume"
            value={`${(stats.totalVolume / 1000).toFixed(1)}k`}
            sublabel={weightUnit.unitLabel}
          />
          <StatCard
            icon={Trophy}
            label="Personal Records"
            value={stats.prsCount}
          />
        </div>

        <Tabs defaultValue="volume">
          <TabsList className="w-full">
            <TabsTrigger value="volume" className="flex-1">
              Volume
            </TabsTrigger>
            <TabsTrigger value="training" className="flex-1">
              Training
            </TabsTrigger>
            <TabsTrigger value="body" className="flex-1">
              Body
            </TabsTrigger>
            <TabsTrigger value="awards" className="flex-1">
              Awards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="volume" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weekly Volume</CardTitle>
              </CardHeader>
              <CardContent>
                {weeklyData.some((d) => d.volume > 0) ? (
                  <div className={CHART_HEIGHTS.md}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weeklyData} margin={CHART_MARGIN}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="week"
                          tick={CHART_AXIS_STYLE}
                          className="text-muted-foreground"
                        />
                        <YAxis
                          tick={CHART_AXIS_STYLE}
                          className="text-muted-foreground"
                          tickFormatter={volumeTickFormatter}
                        />
                        <Tooltip
                          contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
                          formatter={volumeTooltipFormatter}
                        />
                        <Line
                          type="monotone"
                          dataKey="volume"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          dot={LINE_DOT_CONFIG}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className={cn("flex items-center justify-center text-muted-foreground", CHART_HEIGHTS.md)}>
                    Complete some workouts to see your progress!
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="training" className="mt-4 space-y-4">
            {/* Muscle Balance Section */}
            <MuscleBalanceTab workouts={recentWorkouts} exercises={exercises} />

            {/* Exercise Progress Section */}
            <div className="pt-2">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">Exercise Progress</h3>
              <ExerciseProgressTab
                exercises={exercises}
                selectedExerciseId={selectedExerciseId}
                setSelectedExerciseId={setSelectedExerciseId}
                selectedExerciseHistory={selectedExerciseHistory}
                weightUnit={weightUnit}
              />
            </div>
          </TabsContent>

          <TabsContent value="body" className="mt-4 space-y-4">
            {/* Body Weight Section */}
            <BodyWeightTab
              newWeight={newWeight}
              setNewWeight={setNewWeight}
              addWeightEntry={async (weight: number, date?: string) => {
                await addWeightEntryMutation.mutateAsync({ weight, date: date || getToday() })
              }}
              deleteWeightEntry={async (id: string) => {
                await deleteWeightEntryMutation.mutateAsync(id)
              }}
              preferredUnit={weightUnit.unit}
              weightEntries={weightEntries}
            />

            {/* Personal Records Section */}
            <div className="pt-2">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">Personal Records</h3>
              {sortedPRs.length > 0 ? (
                <div className="space-y-2">
                  {sortedPRs.map((personalRecord) => (
                    <Card key={personalRecord.exerciseId}>
                      <CardContent className="flex items-center gap-4 py-3">
                        <AchievementBadge icon={Trophy} />
                        <div className="flex-1">
                          <p className="font-medium">{personalRecord.exercise?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {weightUnit.format(personalRecord.weight, { shouldShowUnit: false })} {weightUnit.unitLabel} x {personalRecord.reps} reps
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">
                            {weightUnit.format(Math.round(personalRecord.oneRepMax))}
                          </p>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Est. 1RM</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Trophy className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Complete some workouts to track your PRs!
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="awards" className="mt-4 space-y-4">
            <AchievementsTab
              totalWorkouts={stats.totalWorkouts}
              totalVolume={stats.totalVolume}
              prCount={stats.prsCount}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
