import { useMemo } from "react"
import { format, subDays, startOfWeek, eachDayOfInterval } from "date-fns"
import { Trophy, TrendingUp, Dumbbell, Calendar } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useWorkoutStore } from "@/stores/workoutStore"
import { useExerciseStore } from "@/stores/exerciseStore"

export function ProgressPage() {
  const { workouts, personalRecords, calculateOneRepMax } = useWorkoutStore()
  const { getExercise } = useExerciseStore()

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

  // Calculate workout frequency by day of week
  const frequencyData = useMemo(() => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const counts = Array(7).fill(0)

    workouts.forEach((w) => {
      const day = new Date(w.date).getDay()
      counts[day]++
    })

    return dayNames.map((name, i) => ({
      day: name,
      count: counts[i],
    }))
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
            <TabsTrigger value="frequency" className="flex-1">
              Frequency
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

          <TabsContent value="frequency" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Workout Frequency</CardTitle>
              </CardHeader>
              <CardContent>
                {frequencyData.some((d) => d.count > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={frequencyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value) => [value as number, "Workouts"]}
                      />
                      <Bar
                        dataKey="count"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                    Complete some workouts to see your frequency!
                  </div>
                )}
              </CardContent>
            </Card>
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
