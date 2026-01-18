import { useMemo, useCallback } from "react"
import { format, parseISO } from "date-fns"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useWeightUnit } from "@/hooks/useWeightUnit"

const CHART_MARGIN = { top: 5, right: 5, left: 5, bottom: 5 }
const CHART_AXIS_STYLE = { fontSize: 12 }
const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
}
const LINE_DOT_CONFIG = { fill: "hsl(var(--primary))" }

interface ExerciseProgressTabProps {
  exercises: { id: string; name: string; muscleGroup: string }[]
  selectedExerciseId: string | null
  setSelectedExerciseId: (id: string | null) => void
  selectedExerciseHistory: Array<{
    date: string
    workoutId: string
    maxWeight: number
    totalVolume: number
    totalReps: number
    sets: Array<{ id: string; weight: number; reps: number }>
  }>
  weightUnit: ReturnType<typeof useWeightUnit>
}

export function ExerciseProgressTab({
  exercises,
  selectedExerciseId,
  setSelectedExerciseId,
  selectedExerciseHistory,
  weightUnit,
}: ExerciseProgressTabProps) {
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

  const exerciseTooltipFormatter = useCallback((value: ValueType | undefined) => [`${String(value ?? 0)} ${weightUnit.unitLabel}`, "Max Weight"] as [string, string], [weightUnit.unitLabel])
  const exerciseDomain = useMemo(() => ["dataMin - 5", "dataMax + 5"] as [string, string], [])

  return (
    <div className="space-y-4">
      {/* Exercise Picker */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Select Exercise</CardTitle>
        </CardHeader>
        <CardContent>
          {exercises.length > 0 ? (
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedExerciseId || ""}
              onChange={(e) => setSelectedExerciseId(e.target.value || null)}
            >
              <option value="">Choose an exercise...</option>
              {exercises.map((ex) => (
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
                  <LineChart data={chartData} margin={CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={CHART_AXIS_STYLE}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={CHART_AXIS_STYLE}
                      className="text-muted-foreground"
                      domain={exerciseDomain}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      formatter={exerciseTooltipFormatter}
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={LINE_DOT_CONFIG}
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
                        {session.sets.map((set) => (
                          <span
                            key={set.id}
                            className="rounded bg-primary/10 px-1.5 py-0.5 text-xs"
                          >
                            {weightUnit.format(set.weight, { shouldShowUnit: false })}x{set.reps}
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
    </div>
  )
}
