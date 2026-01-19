import { useMemo, useState } from "react"
import { format, subDays } from "date-fns"
import { Activity } from "lucide-react"
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { MuscleGroup } from "@/lib/types"
import { muscleGroupLabels } from "@/lib/muscleGroups"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CHART_HEIGHTS, CHART_AXIS_STYLE, CHART_TOOLTIP_STYLE } from "@/lib/chartConfig"

// Muscle group balance data for radar chart
const MUSCLE_GROUPS: MuscleGroup[] = ["chest", "back", "shoulders", "arms", "legs", "core"]

interface MuscleBalanceTabProps {
  workouts: Array<{
    id: string
    date: string
    exercises: Array<{
      exerciseId: string
      sets: Array<{ isCompleted: boolean; weight: number; reps: number }>
    }>
  }>
  exercises: Array<{ id: string; muscleGroup: MuscleGroup }>
}

export function MuscleBalanceTab({
  workouts,
  exercises,
}: MuscleBalanceTabProps) {
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30)

  // Calculate workout frequency per muscle group
  const muscleData = useMemo(() => {
    const exercisesById = new Map(exercises.map(ex => [ex.id, ex]))
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
        const exercise = exercisesById.get(ex.exerciseId)
        const hasCompletedSets = ex.sets.some((s) => s.isCompleted)
        
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

  const radarDomain = useMemo(() => [0, "dataMax"] as const, [])
  const radarAxisStyle = useMemo(() => ({ fontSize: 10 }), [])

  return (
    <div className="space-y-4">
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
            <div className={CHART_HEIGHTS.lg}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={muscleData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid className="stroke-muted" />
                  <PolarAngleAxis
                    dataKey="muscle"
                    tick={CHART_AXIS_STYLE}
                    className="text-muted-foreground"
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={radarDomain}
                    tick={radarAxisStyle}
                    className="text-muted-foreground"
                  />
                  <Radar
                    name="Workouts"
                    dataKey="frequency"
                    stroke="var(--primary)"
                    fill="var(--primary)"
                    fillOpacity={0.5}
                    strokeWidth={2}
                  />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE.contentStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className={cn("flex items-center justify-center text-muted-foreground", CHART_HEIGHTS.lg)}>
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
    </div>
  )
}
