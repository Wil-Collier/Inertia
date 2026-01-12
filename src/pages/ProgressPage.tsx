import { useMemo, useState } from "react"
import { format, subDays, startOfWeek, eachDayOfInterval, parseISO } from "date-fns"
import { Trophy, TrendingUp, Dumbbell, Calendar, Scale, Trash2, TrendingDown, Minus } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWorkoutStore } from "@/stores/workoutStore"
import { useExerciseStore } from "@/stores/exerciseStore"
import { useBodyWeightStore, getTodayDate } from "@/stores/bodyWeightStore"
import { toast } from "sonner"

export function ProgressPage() {
  const { workouts, personalRecords, calculateOneRepMax, getExerciseHistory } = useWorkoutStore()
  const { getExercise, exercises } = useExerciseStore()
  const {
    entries: weightEntries,
    preferredUnit,
    addEntry: addWeightEntry,
    deleteEntry: deleteWeightEntry,
    getLatestEntry,
    getEntriesForRange,
  } = useBodyWeightStore()

  const [newWeight, setNewWeight] = useState("")
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)

  // Calculate weekly volume data
  const weeklyData = useMemo(() => {
    const today = new Date()
    const weeks: { week: string; volume: number; workouts: number }[] = []

    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subDays(today, i * 7))
      const weekEnd = subDays(weekStart, -6)
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
      const weekDates = weekDays.map((d) => format(d, "yyyy-MM-dd"))

      const weekWorkouts = workouts.filter((w) => weekDates.includes(w.date))

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
  }, [workouts])

  // Get sorted personal records
  const sortedPRs = useMemo(() => {
    return Object.values(personalRecords)
      .map((pr) => ({
        ...pr,
        exercise: getExercise(pr.exerciseId),
        oneRepMax: calculateOneRepMax(pr.weight, pr.reps),
      }))
      .filter((pr) => pr.exercise)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [personalRecords, getExercise, calculateOneRepMax])

  // Stats summary
  const stats = useMemo(() => {
    const totalWorkouts = workouts.length
    const totalVolume = workouts.reduce((total, workout) => {
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

    const last30Days = workouts.filter((w) => {
      const date = new Date(w.date)
      const thirtyDaysAgo = subDays(new Date(), 30)
      return date >= thirtyDaysAgo
    }).length

    return {
      totalWorkouts,
      totalVolume: Math.round(totalVolume),
      last30Days,
      prsCount: Object.keys(personalRecords).length,
    }
  }, [workouts, personalRecords])

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
            sublabel="lbs"
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
            <TabsTrigger value="exercises" className="flex-1">
              Exercises
            </TabsTrigger>
            <TabsTrigger value="body" className="flex-1">
              Body
            </TabsTrigger>
            <TabsTrigger value="prs" className="flex-1">
              PRs
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
                        formatter={(value) => [`${(value as number).toLocaleString()} lbs`, "Volume"]}
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

          <TabsContent value="exercises" className="mt-4 space-y-4">
            <ExerciseProgressTab
              exercises={exercises}
              selectedExerciseId={selectedExerciseId}
              setSelectedExerciseId={setSelectedExerciseId}
              getExerciseHistory={getExerciseHistory}
              getExercise={getExercise}
            />
          </TabsContent>

          <TabsContent value="body" className="mt-4 space-y-4">
            <BodyWeightTab
              newWeight={newWeight}
              setNewWeight={setNewWeight}
              addWeightEntry={addWeightEntry}
              deleteWeightEntry={deleteWeightEntry}
              getLatestEntry={getLatestEntry}
              getEntriesForRange={getEntriesForRange}
              preferredUnit={preferredUnit}
              weightEntries={weightEntries}
            />
          </TabsContent>

          <TabsContent value="prs" className="mt-4 space-y-3">
            {sortedPRs.length > 0 ? (
              sortedPRs.map((pr) => (
                <Card key={pr.exerciseId}>
                  <CardContent className="flex items-center gap-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{pr.exercise?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {pr.weight} lbs x {pr.reps} reps
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">
                        {Math.round(pr.oneRepMax)} lbs
                      </p>
                      <p className="text-xs text-muted-foreground">Est. 1RM</p>
                    </div>
                  </CardContent>
                </Card>
              ))
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
  getLatestEntry,
  getEntriesForRange,
  preferredUnit,
  weightEntries,
}: {
  newWeight: string
  setNewWeight: (value: string) => void
  addWeightEntry: (weight: number, date?: string, note?: string) => void
  deleteWeightEntry: (id: string) => void
  getLatestEntry: () => { id: string; date: string; weight: number; note?: string } | undefined
  getEntriesForRange: (start: string, end: string) => { id: string; date: string; weight: number; note?: string }[]
  preferredUnit: "lbs" | "kg"
  weightEntries: { id: string; date: string; weight: number; note?: string }[]
}) {
  const latestEntry = getLatestEntry()

  // Get weight change
  const sortedEntries = [...weightEntries].sort((a, b) => b.date.localeCompare(a.date))
  const previousEntry = sortedEntries.length > 1 ? sortedEntries[1] : undefined
  const weightChange = latestEntry && previousEntry
    ? latestEntry.weight - previousEntry.weight
    : 0

  // Get last 30 days of data for chart
  const today = format(new Date(), "yyyy-MM-dd")
  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd")
  const chartData = getEntriesForRange(thirtyDaysAgo, today).map((e) => ({
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
                <span className={weightChange > 0 ? "text-red-500" : "text-green-500"}>
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
                          <TrendingUp className="h-4 w-4 text-red-500" />
                        ) : change < 0 ? (
                          <TrendingDown className="h-4 w-4 text-green-500" />
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
  getExerciseHistory,
  getExercise,
}: {
  exercises: { id: string; name: string; muscleGroup: string }[]
  selectedExerciseId: string | null
  setSelectedExerciseId: (id: string | null) => void
  getExerciseHistory: (exerciseId: string) => Array<{
    date: string
    workoutId: string
    maxWeight: number
    totalVolume: number
    totalReps: number
    sets: Array<{ weight: number; reps: number }>
  }>
  getExercise: (id: string) => { id: string; name: string; muscleGroup: string } | undefined
}) {
  // Get exercises that have workout history
  const exercisesWithHistory = useMemo(() => {
    return exercises.filter((ex) => getExerciseHistory(ex.id).length > 0)
  }, [exercises, getExerciseHistory])

  // Get history for selected exercise
  const history = selectedExerciseId ? getExerciseHistory(selectedExerciseId) : []
  const selectedExercise = selectedExerciseId ? getExercise(selectedExerciseId) : null

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
                      formatter={(value) => [`${String(value ?? 0)} lbs`, "Max Weight"]}
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
                        Max: {session.maxWeight} lbs | Volume: {session.totalVolume.toLocaleString()} lbs
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {session.sets.map((set, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-primary/10 px-1.5 py-0.5 text-xs"
                          >
                            {set.weight}x{set.reps}
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
