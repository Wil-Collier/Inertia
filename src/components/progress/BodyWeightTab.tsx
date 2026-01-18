import { useMemo, useCallback } from "react"
import { format, subDays, parseISO } from "date-fns"
import { Scale, TrendingUp, TrendingDown, Minus, Trash2 } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getTodayDate } from "@/stores/bodyWeightStore"
import { toast } from "sonner"

const CHART_MARGIN = { top: 5, right: 5, left: 5, bottom: 5 }
const CHART_AXIS_STYLE = { fontSize: 12 }
const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
}
const LINE_DOT_CONFIG = { fill: "hsl(var(--primary))" }

interface BodyWeightTabProps {
  newWeight: string
  setNewWeight: (value: string) => void
  addWeightEntry: (weight: number, date?: string, note?: string) => void
  deleteWeightEntry: (id: string) => void
  preferredUnit: "lbs" | "kg"
  weightEntries: { id: string; date: string; weight: number; note?: string }[]
}

export function BodyWeightTab({
  newWeight,
  setNewWeight,
  addWeightEntry,
  deleteWeightEntry,
  preferredUnit,
  weightEntries,
}: BodyWeightTabProps) {
  const latestEntry = weightEntries[0]

  // Get weight change
  const sortedEntries = weightEntries
  const previousEntry = sortedEntries.length > 1 ? sortedEntries[1] : undefined
  const weightChange = latestEntry && previousEntry
    ? latestEntry.weight - previousEntry.weight
    : 0

  // Get last 30 days of data for chart
  const chartData = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd")
    const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd")
    return weightEntries
      .filter((e) => e.date >= thirtyDaysAgo && e.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({
        date: format(parseISO(e.date), "MMM d"),
        weight: e.weight,
      }))
  }, [weightEntries])

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

  const weightTooltipFormatter = useCallback((value: any) => [`${String(value ?? 0)} ${preferredUnit}`, "Weight"], [preferredUnit])
  const weightDomain = useMemo(() => ["dataMin - 2", "dataMax + 2"] as [string, string], [])

  return (
    <div className="space-y-4">
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
                  domain={weightDomain}
                />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  formatter={weightTooltipFormatter}
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
    </div>
  )
}
