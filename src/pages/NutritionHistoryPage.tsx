import { useState, useMemo, useCallback } from "react"
import { format, subDays, parseISO } from "date-fns"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
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
  Legend,
} from "recharts"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useNutritionDates, useNutritionHistory } from "@/features/nutrition/queries"
import { useSettings } from "@/features/settings/queries"
import { CHART_AXIS_STYLE, CHART_TOOLTIP_STYLE } from "@/lib/chartConfig"
import { INITIAL_TOTALS } from "@/lib/nutritionUtils"

type DateRange = "7d" | "30d" | "90d"

const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
]

// Chart Configuration Constants
const CALORIES_BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0]
const MACRO_LINE_STROKE_WIDTH = 2

export function NutritionHistoryPage() {
  const [dateRange, setDateRange] = useState<DateRange>("30d")

  const { data: settings } = useSettings()
  const nutritionGoals = settings?.nutritionGoals ?? {
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 65,
    fiber: 30,
    sugar: 50
  }

  const { startDate, endDate } = useMemo(() => {
    const end = new Date()
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90
    const start = subDays(end, days - 1)
    return {
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
    }
  }, [dateRange])

  const { data: historyData, isLoading } = useNutritionHistory(startDate, endDate)

  const dailyTotals = useMemo(() => historyData?.dailyTotals ?? [], [historyData?.dailyTotals])
  const averages = historyData?.averages ?? INITIAL_TOTALS

  const { data: loggedDates = [] } = useNutritionDates()

  const daysWithData = dailyTotals.filter((d) => d.calories > 0).length

  // Format data for charts
  const chartData = useMemo(() => {
    return dailyTotals.map((day) => ({
      ...day,
      dateLabel: format(parseISO(day.date), "MMM d"),
      shortDate: format(parseISO(day.date), "M/d"),
    }))
  }, [dailyTotals])

  // Calculate trend (comparing last 7 days to previous 7 days)
  const caloriesTrend = useMemo(() => {
    if (dailyTotals.length < 14) return null
    const recent = dailyTotals.slice(-7)
    const previous = dailyTotals.slice(-14, -7)

    const recentAvg =
      recent.reduce((s, d) => s + d.calories, 0) / recent.length
    const previousAvg =
      previous.reduce((s, d) => s + d.calories, 0) / previous.length

    if (previousAvg === 0) return null
    const change = ((recentAvg - previousAvg) / previousAvg) * 100
    return Math.round(change)
  }, [dailyTotals])

  // Chart Formatters
  const caloriesTooltipFormatter = useCallback((value: number | string | Array<number | string> | undefined) => [`${String(value ?? 0)} Cal`, "Calories"] as [string, string], [])
  const caloriesLabelFormatter = useCallback((_label: React.ReactNode, payload: readonly { payload?: { dateLabel?: string } }[]) => {
    if (payload?.[0]?.payload?.dateLabel) {
      return payload[0].payload.dateLabel
    }
    return ""
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <Header title="Nutrition History" showBack />
        <div className="flex flex-1 items-center justify-center p-12">
          <p className="text-muted-foreground">Loading history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <Header title="Nutrition History" showBack />

      <div className="space-y-4 p-4">
        {/* Date Range Selector */}
        <div className="flex justify-center gap-2">
          {dateRangeOptions.map((option) => (
            <Button
              key={option.value}
              variant={dateRange === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="py-4">
              <p className="text-xxs font-bold text-muted-foreground uppercase tracking-widest mb-1">Avg. Calories</p>
              <div className="flex items-center gap-2">
                <p className="text-4xl font-black tracking-tighter">{averages.calories}</p>
                {caloriesTrend !== null && (
                  <span
                    className={`flex items-center text-xxs font-bold px-1.5 py-0.5 rounded-full ${caloriesTrend > 0
                        ? "bg-trend-positive/10 text-trend-positive"
                        : caloriesTrend < 0
                          ? "bg-trend-negative/10 text-trend-negative"
                          : "bg-muted text-muted-foreground"
                      }`}
                  >
                    {caloriesTrend > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-0.5" />
                    ) : caloriesTrend < 0 ? (
                      <TrendingDown className="h-3 w-3 mr-0.5" />
                    ) : (
                      <Minus className="h-3 w-3 mr-0.5" />
                    )}
                    {Math.abs(caloriesTrend)}%
                  </span>
                )}
              </div>
              <p className="text-xxs font-medium text-muted-foreground/60 italic mt-1">
                Goal: {nutritionGoals.calories} Cal
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <p className="text-xxs font-bold text-muted-foreground uppercase tracking-widest mb-1">Days Logged</p>
              <p className="text-4xl font-black tracking-tighter">{daysWithData}</p>
              <p className="text-xxs font-medium text-muted-foreground/60 italic mt-1">
                of {dailyTotals.length} days
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Macro Averages */}
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-xs font-black uppercase italic tracking-widest text-muted-foreground">Daily Averages</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-4">
              <MacroStat
                label="Protein"
                value={averages.protein}
                goal={nutritionGoals.protein}
                unit="g"
                color="text-macro-protein"
              />
              <MacroStat
                label="Carbs"
                value={averages.carbs}
                goal={nutritionGoals.carbs}
                unit="g"
                color="text-macro-carbs"
              />
              <MacroStat
                label="Fat"
                value={averages.fat}
                goal={nutritionGoals.fat}
                unit="g"
                color="text-macro-fat"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <MacroStat
                label="Fiber"
                value={averages.fiber}
                goal={nutritionGoals.fiber}
                unit="g"
                color="text-macro-fiber"
              />
              <MacroStat
                label="Sugar"
                value={averages.sugar}
                goal={nutritionGoals.sugar}
                unit="g"
                color="text-macro-sugar"
              />
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <Tabs defaultValue="calories" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="calories" className="flex-1">
              Calories
            </TabsTrigger>
            <TabsTrigger value="macros" className="flex-1">
              Macros
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calories" className="mt-4">
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-xs font-black uppercase italic tracking-widest text-muted-foreground">Daily Calories</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {daysWithData > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                        />
                        <XAxis
                          dataKey="shortDate"
                          tick={CHART_AXIS_STYLE}
                          interval="preserveStartEnd"
                          className="text-muted-foreground"
                        />
                        <YAxis
                          tick={CHART_AXIS_STYLE}
                          className="text-muted-foreground"
                          domain={[0, "dataMax + 200"]}
                        />
                        <Tooltip
                          contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
                          labelFormatter={caloriesLabelFormatter}
                          formatter={caloriesTooltipFormatter}
                        />
                        <Bar
                          dataKey="calories"
                          fill="var(--calories)"
                          radius={CALORIES_BAR_RADIUS}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No data for this period
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="macros" className="mt-4">
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-xs font-black uppercase italic tracking-widest text-muted-foreground">Macro Trends</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {daysWithData > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                        />
                        <XAxis
                          dataKey="shortDate"
                          tick={CHART_AXIS_STYLE}
                          interval="preserveStartEnd"
                          className="text-muted-foreground"
                        />
                        <YAxis
                          tick={CHART_AXIS_STYLE}
                          className="text-muted-foreground"
                        />
                        <Tooltip
                          contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
                          labelFormatter={caloriesLabelFormatter}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="protein"
                          name="Protein"
                          stroke="var(--macro-protein)"
                          strokeWidth={MACRO_LINE_STROKE_WIDTH}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="carbs"
                          name="Carbs"
                          stroke="var(--macro-carbs)"
                          strokeWidth={MACRO_LINE_STROKE_WIDTH}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="fat"
                          name="Fat"
                          stroke="var(--macro-fat)"
                          strokeWidth={MACRO_LINE_STROKE_WIDTH}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No data for this period
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Logged Dates Info */}
        {loggedDates.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Tracking since {format(parseISO(loggedDates[0]), "MMM d, yyyy")}
          </p>
        )}
      </div>
    </div>
  )
}

function MacroStat({
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
  return (
    <div className="text-center space-y-1">
      <p className="text-xxs font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-black tracking-tighter ${color}`}>
        {value}{unit}
      </p>
      <p className="text-xxs font-medium text-muted-foreground/60 italic">
        Goal: {goal}{unit}
      </p>
    </div>
  )
}
