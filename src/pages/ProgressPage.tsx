import { useMemo, useState } from "react"
import { format, subDays, startOfWeek, eachDayOfInterval, parseISO } from "date-fns"
import { Trophy, TrendingUp, Dumbbell, Calendar, Scale, Trash2, TrendingDown, Minus, Activity, Award } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts"
import type { MuscleGroup } from "@/lib/types"
import { muscleGroupLabels } from "@/lib/muscleGroups"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StreakDisplay } from "@/components/StreakDisplay"
import { AchievementCard } from "@/components/AchievementCard"
import { useExercisesDB, useExercisesByIdsDB } from "@/hooks/db/useExercisesDB"
import { useBodyWeightStore, getTodayDate } from "@/stores/bodyWeightStore"
import { useBodyWeightDB } from "@/hooks/db/useBodyWeightDB"
import { useAchievementsStore } from "@/stores/achievementsStore"
import { useWorkoutStatsDB, usePersonalRecordsDB, useExerciseHistoryDB } from "@/hooks/db/useWorkoutsDB"
import { calculateOneRepMax } from "@/lib/workoutUtils"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { achievements, categoryLabels } from "@/data/achievements"
import { toast } from "sonner"

import { useProgressStatsDB } from "@/hooks/db/useProgressStatsDB"

export function ProgressPage() {
  // 1. Efficient Stats
  const stats = useProgressStatsDB()
  
  // 2. Fetch data for charts (last 90 days is enough for both weekly chart and max muscle balance range)
  const ninetyDaysAgo = useMemo(() => format(subDays(new Date(), 90), "yyyy-MM-dd"), [])
  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), [])
  
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
      const weekStart = startOfWeek(subDays(today, i * 7))
      const weekEnd = subDays(weekStart, -6)
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
      const weekDates = weekDays.map((d) => format(d, "yyyy-MM-dd"))

      const weekWorkouts = recentWorkouts.filter((w) => weekDates.includes(w.date))

      const volume = weekWorkouts.reduce((total, workout) => {
        return (
          total +
          workout.exercises.reduce((exTotal, ex) => {
            return (
              exTotal +
              ex.sets
                .filter((s) => s.completed)
                .reduce((setTotal, set) => {
                  return setTotal + set.weight * set.reps
                }, 0)
            )
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
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [personalRecords, prExerciseMap])

  // Stats summary REMOVED (now using hook directly)

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
                    <LineChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value) => [`${(value as number).toLocaleString()} ${weightUnit.unitLabel}`, "Volume"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="volume"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))" }}
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
                  {sortedPRs.map((pr) => (
                    <Card key={pr.exerciseId}>
                      <CardContent className="flex items-center gap-4 py-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500">
                          <Trophy className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{pr.exercise?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {weightUnit.format(pr.weight, { showUnit: false })} {weightUnit.unitLabel} x {pr.reps} reps
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">
                            {weightUnit.format(Math.round(pr.oneRepMax))} 
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

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sublabel?: string
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-xs">{label}</span>
        </div>
        <p className="mt-1 text-2xl font-bold">
          {value}
          {sublabel && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {sublabel}
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  )
}

function BodyWeightTab({
  newWeight,
  setNewWeight,
  addWeightEntry,
  deleteWeightEntry,
  preferredUnit,
  weightEntries,
}: {
  newWeight: string
  setNewWeight: (value: string) => void
  addWeightEntry: (weight: number, date?: string, note?: string) => void
  deleteWeightEntry: (id: string) => void
  preferredUnit: "lbs" | "kg"
  weightEntries: { id: string; date: string; weight: number; note?: string }[]
}) {
  const latestEntry = weightEntries[0]

  // Get weight change
  const sortedEntries = weightEntries
  const previousEntry = sortedEntries.length > 1 ? sortedEntries[1] : undefined
  const weightChange = latestEntry && previousEntry
    ? latestEntry.weight - previousEntry.weight
    : 0

  // Get last 30 days of data for chart
  const today = format(new Date(), "yyyy-MM-dd")
  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd")
  const chartData = weightEntries
    .filter((e) => e.date >= thirtyDaysAgo && e.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({
      date: format(parseISO(e.date), "MMM d"),
      weight: e.weight,
    }))

  const handleAddWeight = () => {
    const weight = parseFloat(newWeight)
    if (isNaN(weight) || weight <= 0) {
      toast.error("Please enter a valid weight")
      return
    }
    addWeightEntry(weight, getTodayDate())
    setNewWeight("")
    toast.success("Weight logged!")
  }

  return (
    <>
      {/* Quick Log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Log Weight</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="number"
                placeholder={`Enter weight (${preferredUnit})`}
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="pr-12"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddWeight()
                }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {preferredUnit}
              </span>
            </div>
            <Button onClick={handleAddWeight}>Log</Button>
          </div>
          {latestEntry && (
            <p className="mt-2 text-sm text-muted-foreground">
              Current: {latestEntry.weight} {preferredUnit}
              {weightChange !== 0 && (
                <span className={weightChange > 0 ? "text-trend-negative" : "text-trend-positive"}>
                  {" "}({weightChange > 0 ? "+" : ""}{weightChange.toFixed(1)})
                </span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Weight Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weight Trend (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  domain={["dataMin - 2", "dataMax + 2"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value) => [`${String(value ?? 0)} ${preferredUnit}`, "Weight"]}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Scale className="mx-auto mb-2 h-8 w-8" />
                <p>Log at least 2 entries to see your trend</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedEntries.length > 0 ? (
            <div className="space-y-2">
              {sortedEntries.slice(0, 10).map((entry, index) => {
                const prevEntry = sortedEntries[index + 1]
                const change = prevEntry ? entry.weight - prevEntry.weight : 0

                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        {change > 0 ? (
                          <TrendingUp className="h-4 w-4 text-trend-negative" />
                        ) : change < 0 ? (
                          <TrendingDown className="h-4 w-4 text-trend-positive" />
                        ) : (
                          <Minus className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {entry.weight} {preferredUnit}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(entry.date), "EEE, MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => deleteWeightEntry(entry.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No weight entries yet. Log your first entry above!
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function ExerciseProgressTab({
  exercises,
  selectedExerciseId,
  setSelectedExerciseId,
  selectedExerciseHistory,
  weightUnit,
}: {
  exercises: { id: string; name: string; muscleGroup: string }[]
  selectedExerciseId: string | null
  setSelectedExerciseId: (id: string | null) => void
  selectedExerciseHistory: Array<{
    date: string
    workoutId: string
    maxWeight: number
    totalVolume: number
    totalReps: number
    sets: Array<{ weight: number; reps: number }>
  }>
  weightUnit: ReturnType<typeof useWeightUnit>
}) {
  // Get exercises that have workout history
  // Note: This is still O(N) over all exercises but we'll optimize it later if needed
  const exercisesWithHistory = useMemo(() => {
    // Ideally we should have a list from DB of which exercises have history
    return exercises
  }, [exercises])

  // Get history for selected exercise
  const history = selectedExerciseHistory
  const selectedExercise = useMemo(() => 
    selectedExerciseId ? exercises.find(ex => ex.id === selectedExerciseId) : null
  , [selectedExerciseId, exercises])

  // Chart data
  const chartData = history.map((h) => ({
    date: format(parseISO(h.date), "MMM d"),
    weight: h.maxWeight,
    volume: h.totalVolume,
  }))

  return (
    <>
      {/* Exercise Picker */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Select Exercise</CardTitle>
        </CardHeader>
        <CardContent>
          {exercisesWithHistory.length > 0 ? (
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedExerciseId || ""}
              onChange={(e) => setSelectedExerciseId(e.target.value || null)}
            >
              <option value="">Choose an exercise...</option>
              {exercisesWithHistory.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete some workouts to track exercise progress!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Progress Chart */}
      {selectedExercise && history.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {selectedExercise.name} - Weight Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      domain={["dataMin - 5", "dataMax + 5"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value) => [`${String(value ?? 0)} ${weightUnit.unitLabel}`, "Max Weight"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Need at least 2 sessions to show trend
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {history
                  .slice()
                  .reverse()
                  .slice(0, 5)
                  .map((session) => (
                    <div
                      key={session.workoutId}
                      className="rounded-lg bg-muted/50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {format(parseISO(session.date), "EEE, MMM d")}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {session.sets.length} sets
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Max: {weightUnit.format(session.maxWeight)} | Volume: {weightUnit.format(session.totalVolume, { decimals: 0 })}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {session.sets.map((set, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-primary/10 px-1.5 py-0.5 text-xs"
                          >
                            {weightUnit.format(set.weight, { showUnit: false })}x{set.reps}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}

// Muscle group balance data for radar chart
const MUSCLE_GROUPS: MuscleGroup[] = ["chest", "back", "shoulders", "arms", "legs", "core"]

function MuscleBalanceTab({
  workouts,
  exercises,
}: {
  workouts: Array<{
    id: string
    date: string
    exercises: Array<{
      exerciseId: string
      sets: Array<{ completed: boolean; weight: number; reps: number }>
    }>
  }>
  exercises: Array<{ id: string; muscleGroup: MuscleGroup }>
}) {
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30)

  // Calculate workout frequency per muscle group
  const muscleData = useMemo(() => {
    const exerciseMap = new Map(exercises.map(ex => [ex.id, ex]))
    const cutoff = subDays(new Date(), timeRange)
    const cutoffStr = format(cutoff, "yyyy-MM-dd")

    const recentWorkouts = workouts.filter((w) => w.date >= cutoffStr)

    const frequencyByGroup: Record<MuscleGroup, number> = {
      chest: 0,
      back: 0,
      shoulders: 0,
      arms: 0,
      legs: 0,
      core: 0,
      cardio: 0,
    }

    recentWorkouts.forEach((workout) => {
      // Track which muscle groups were hit in this specific workout
      const trainedInThisWorkout = new Set<MuscleGroup>()

      workout.exercises.forEach((ex) => {
        const exercise = exerciseMap.get(ex.exerciseId)
        const hasCompletedSets = ex.sets.some((s) => s.completed)
        
        if (exercise && hasCompletedSets) {
          trainedInThisWorkout.add(exercise.muscleGroup)
        }
      })

      // Increment counter for each muscle group trained
      trainedInThisWorkout.forEach((mg) => {
        frequencyByGroup[mg]++
      })
    })

    // Get max for scaling
    const maxFreq = Math.max(...MUSCLE_GROUPS.map((mg) => frequencyByGroup[mg]), 1)

    return MUSCLE_GROUPS.map((mg) => ({
      muscle: muscleGroupLabels[mg],
      muscleGroup: mg,
      frequency: frequencyByGroup[mg],
      fullMark: maxFreq,
    }))
  }, [workouts, exercises, timeRange])

  // Total "muscle-workouts" (sum of all frequencies) to calculate percentages
  const totalMuscleHits = muscleData.reduce((sum, d) => sum + d.frequency, 0)
  const hasData = totalMuscleHits > 0

  // Find undertrained muscle groups (less than 50% of average frequency)
  const avgFreq = totalMuscleHits / MUSCLE_GROUPS.length
  const undertrainedGroups = muscleData.filter((d) => d.frequency < avgFreq * 0.5 && avgFreq > 0)

  return (
    <>
      {/* Time Range Selector */}
      <div className="flex gap-2">
        {([7, 30, 90] as const).map((days) => (
          <Button
            key={days}
            size="sm"
            variant={timeRange === days ? "default" : "outline"}
            onClick={() => setTimeRange(days)}
            className="flex-1"
          >
            {days}d
          </Button>
        ))}
      </div>

      {/* Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Muscle Group Frequency
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={muscleData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid className="stroke-muted" />
                <PolarAngleAxis
                  dataKey="muscle"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, "dataMax"]}
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <Radar
                  name="Workouts"
                  dataKey="frequency"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.5}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Activity className="mx-auto mb-2 h-8 w-8" />
                <p>Complete some workouts to see your balance!</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workouts per Muscle Group</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {muscleData.map((item) => {
              // Percentage based on total "hits" (e.g. if I did chest 5 times and back 5 times, total is 10, chest is 50%)
              // This shows relative focus
              const percentage = totalMuscleHits > 0 ? (item.frequency / totalMuscleHits) * 100 : 0
              const isUndertrained = undertrainedGroups.some((u) => u.muscleGroup === item.muscleGroup)

              return (
                <div key={item.muscleGroup} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className={isUndertrained ? "text-destructive" : ""}>
                      {item.muscle}
                      {isUndertrained && " (Low)"}
                    </span>
                    <span className="font-medium">
                      {item.frequency} workouts ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isUndertrained ? "bg-destructive" : "bg-primary"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {undertrainedGroups.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Consider adding more{" "}
              {undertrainedGroups.map((g) => g.muscle.toLowerCase()).join(", ")} sessions to
              balance your training.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function AchievementsTab({
  totalWorkouts,
  totalVolume,
  prCount,
}: {
  totalWorkouts: number
  totalVolume: number
  prCount: number
}) {
  const { unlockedAchievements, getUnlockedAchievement } = useAchievementsStore()
  const [showLocked, setShowLocked] = useState(true)

  // Group achievements by category
  const groupedAchievements = useMemo(() => {
    const groups: Record<string, typeof achievements> = {}
    for (const achievement of achievements) {
      if (!groups[achievement.category]) {
        groups[achievement.category] = []
      }
      groups[achievement.category].push(achievement)
    }
    return groups
  }, [])

  // Get progress for each achievement
  const getProgress = (achievementId: string): number | undefined => {
    switch (achievementId) {
      case "first-workout":
      case "ten-workouts":
      case "fifty-workouts":
      case "century-club":
        return totalWorkouts
      case "10k-club":
      case "100k-crusher":
      case "500k-beast":
      case "million-pounder":
        return totalVolume
      case "first-pr":
      case "pr-collector":
      case "pr-master":
        return prCount
      default:
        return undefined
    }
  }

  const unlockedCount = unlockedAchievements.length
  const totalCount = achievements.length

  return (
    <>
      {/* Streaks */}
      <StreakDisplay />

      {/* Progress Summary */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {unlockedCount} / {totalCount}
              </p>
              <p className="text-sm text-muted-foreground">
                Achievements Unlocked
              </p>
            </div>
            <div className="ml-auto">
              <Button
                size="sm"
                variant={showLocked ? "default" : "outline"}
                onClick={() => setShowLocked(!showLocked)}
              >
                {showLocked ? "Hide Locked" : "Show All"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Achievements by Category */}
      {Object.entries(groupedAchievements).map(([category, categoryAchievements]) => {
        const visibleAchievements = showLocked
          ? categoryAchievements
          : categoryAchievements.filter((a) => getUnlockedAchievement(a.id))

        if (visibleAchievements.length === 0) return null

        return (
          <div key={category} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {categoryLabels[category as keyof typeof categoryLabels]}
            </h3>
            <div className="space-y-2">
              {visibleAchievements.map((achievement) => (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  unlocked={getUnlockedAchievement(achievement.id)}
                  progress={getProgress(achievement.id)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}
