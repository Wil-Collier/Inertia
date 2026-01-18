import { useMemo, useState, useCallback } from "react"
import { startOfWeek, eachDayOfInterval } from "date-fns"
import { Trophy, TrendingUp, Dumbbell, Calendar } from "lucide-react"
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
import { useExercisesDB, useExercisesByIdsDB } from "@/hooks/db/useExercisesDB"
import { useBodyWeightStore } from "@/stores/bodyWeightStore"
import { useBodyWeightDB } from "@/hooks/db/useBodyWeightDB"
import { useWorkoutStatsDB, usePersonalRecordsDB, useExerciseHistoryDB } from "@/hooks/db/useWorkoutsDB"
import { calculateOneRepMax, calculateSetVolume } from "@/lib/workoutUtils"
import { getNinetyDaysAgo, getToday, formatDate } from "@/lib/dateUtils"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useProgressStatsDB } from "@/hooks/db/useProgressStatsDB"

// Internal Components
import { StatCard } from "@/components/progress/StatCard"
import { BodyWeightTab } from "@/components/progress/BodyWeightTab"
import { ExerciseProgressTab } from "@/components/progress/ExerciseProgressTab"
import { MuscleBalanceTab } from "@/components/progress/MuscleBalanceTab"
import { AchievementsTab } from "@/components/progress/AchievementsTab"

// Chart Configuration Constants
const CHART_MARGIN = { top: 5, right: 5, left: 5, bottom: 5 }
const CHART_AXIS_STYLE = { fontSize: 12 }
const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
}
const LINE_DOT_CONFIG = { fill: "hsl(var(--primary))" }

export function ProgressPage() {
  // 1. Efficient Stats
  const stats = useProgressStatsDB()
  
  // 2. Fetch data for charts (last 90 days is enough for both weekly chart and max muscle balance range)
  const ninetyDaysAgo = useMemo(() => getNinetyDaysAgo(), [])
  const todayStr = useMemo(() => getToday(), [])
  
  const { workouts: recentWorkouts } = useWorkoutStatsDB(ninetyDaysAgo, todayStr)
  
  const personalRecords = usePersonalRecordsDB()
  
  const exercises = useExercisesDB()
  // Resolve exercise names for PRs
  const prExerciseIds = useMemo(() => Object.keys(personalRecords), [personalRecords])
  const prExerciseMap = useExercisesByIdsDB(prExerciseIds)

  const {
    addEntry: addWeightEntry,
    deleteEntry: deleteWeightEntry,
  } = useBodyWeightStore()
  
  const weightEntries = useBodyWeightDB()
  
  const weightUnit = useWeightUnit()

  const [newWeight, setNewWeight] = useState("")
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  
  // Custom hook for exercise history if selected
  const selectedExerciseHistory = useExerciseHistoryDB(selectedExerciseId || "")

  // Calculate weekly volume data
  const weeklyData = useMemo(() => {
    // ... logic uses recentWorkouts instead of workouts
    const today = new Date()
    const weeks: { week: string; volume: number; workouts: number }[] = []

    for (let i = 7; i >= 0; i--) {
      // Logic for calculating week boundaries
      // Note: We manipulate dates here directly to match the chart logic
      // Ideally this could be abstracted too but it's very specific to this chart view
      const referenceDate = new Date(today)
      referenceDate.setDate(today.getDate() - (i * 7))
      
      const weekStart = startOfWeek(referenceDate)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)

      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
      const weekDates = weekDays.map((d) => formatDate(d))

      const weekWorkouts = recentWorkouts.filter((w) => weekDates.includes(w.date))

      const volume = weekWorkouts.reduce((total, workout) => {
        return (
          total +
          workout.exercises.reduce((exTotal, ex) => {
            return exTotal + calculateSetVolume(ex.sets)
          }, 0)
        )
      }, 0)

      weeks.push({
        week: formatDate(weekStart).slice(5), // "MM-dd"ish but original was "MMM d" using format
        // Wait, original was format(weekStart, "MMM d"). Let's stick to import format from date-fns for display
        // or add a formatDisplayDate utility. 
        // For now, I'll import format from date-fns locally for display formatting to avoid breaking the chart x-axis look.
        // Actually, let's keep format imported from date-fns for display strings, but use dateUtils for DB strings.
        // Re-adding format to imports.
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
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [personalRecords, prExerciseMap])

  // Chart formatters
  const volumeTickFormatter = useCallback((value: number) => `${(value / 1000).toFixed(0)}k`, [])
  const volumeTooltipFormatter = useCallback((value: ValueType | undefined) => [`${Number(value ?? 0).toLocaleString()} ${weightUnit.unitLabel}`, "Volume"] as [string, string], [weightUnit.unitLabel])

  return (
    <div className="flex flex-col">
      <Header title="Progress" />

      <div className="space-y-4 p-4">
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
                  <ResponsiveContainer width="100%" height={200}>
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
                        contentStyle={TOOLTIP_CONTENT_STYLE}
                        formatter={volumeTooltipFormatter}
                      />
                      <Line
                        type="monotone"
                        dataKey="volume"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={LINE_DOT_CONFIG}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[200px] items-center justify-center text-muted-foreground">
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
              addWeightEntry={addWeightEntry}
              deleteWeightEntry={deleteWeightEntry}
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
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500">
                          <Trophy className="h-5 w-5" />
                        </div>
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
                          <p className="text-xs text-muted-foreground">Est. 1RM</p>
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

