import { useState, useMemo } from "react"
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
import { useNutritionStore } from "@/stores/nutritionStore"
import { useSettingsStore } from "@/stores/settingsStore"

type DateRange = "7d" | "30d" | "90d"

const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
]

export function NutritionHistoryPage() {
  const [dateRange, setDateRange] = useState<DateRange>("30d")

  const { getDailyTotalsForRange, getAveragesForRange, getLoggedDates } =
    useNutritionStore()
  const { settings } = useSettingsStore()
  const { nutritionGoals } = settings

  const { startDate, endDate } = useMemo(() => {
    const end = new Date()
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90
    const start = subDays(end, days - 1)
    return {
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
    }
  }, [dateRange])

  const dailyData = useMemo(
    () => getDailyTotalsForRange(startDate, endDate),
    [startDate, endDate, getDailyTotalsForRange]
  )

  const averages = useMemo(
    () => getAveragesForRange(startDate, endDate),
    [startDate, endDate, getAveragesForRange]
  )

  const loggedDates = getLoggedDates()
  const daysWithData = dailyData.filter((d) => d.calories > 0).length

  // Format data for charts
  const chartData = useMemo(() => {
    return dailyData.map((day) => ({
      ...day,
      dateLabel: format(parseISO(day.date), "MMM d"),
      shortDate: format(parseISO(day.date), "M/d"),
    }))
  }, [dailyData])

  // Calculate trend (comparing last 7 days to previous 7 days)
  const caloriesTrend = useMemo(() => {
    if (dailyData.length < 14) return null
    const recent = dailyData.slice(-7)
    const previous = dailyData.slice(-14, -7)

    const recentAvg =
      recent.reduce((s, d) => s + d.calories, 0) / recent.length
    const previousAvg =
      previous.reduce((s, d) => s + d.calories, 0) / previous.length

    if (previousAvg === 0) return null
    const change = ((recentAvg - previousAvg) / previousAvg) * 100
    return Math.round(change)
  }, [dailyData])

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
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Avg. Calories</p>
              <div className="flex items-center gap-2">
                <p className="text-4xl font-black tracking-tighter">{averages.calories}</p>
                {caloriesTrend !== null && (
                  <span
                    className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      caloriesTrend > 0
                        ? "bg-green-500/10 text-green-500"
                        : caloriesTrend < 0
                          ? "bg-red-500/10 text-red-500"
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
              <p className="text-[10px] font-medium text-muted-foreground/60 italic mt-1">
                Goal: {nutritionGoals.calories} kcal
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Days Logged</p>
              <p className="text-4xl font-black tracking-tighter">{daysWithData}</p>
              <p className="text-[10px] font-medium text-muted-foreground/60 italic mt-1">
                of {dailyData.length} days
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
                color="text-blue-500"
              />
              <MacroStat
                label="Carbs"
                value={averages.carbs}
                goal={nutritionGoals.carbs}
                unit="g"
                color="text-green-500"
              />
              <MacroStat
                label="Fat"
                value={averages.fat}
                goal={nutritionGoals.fat}
                unit="g"
                color="text-yellow-500"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <MacroStat
                label="Fiber"
                value={averages.fiber}
                goal={nutritionGoals.fiber}
                unit="g"
                color="text-orange-500"
              />
              <MacroStat
                label="Sugar"
                value={averages.sugar}
                goal={nutritionGoals.sugar}
                unit="g"
                color="text-pink-500"
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
                          tick={{ fontSize: 10 }}
                          interval="preserveStartEnd"
                          className="text-muted-foreground"
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          className="text-muted-foreground"
                          domain={[0, "dataMax + 200"]}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          labelFormatter={(_, payload) => {
                            if (payload?.[0]?.payload?.dateLabel) {
                              return payload[0].payload.dateLabel
                            }
                            return ""
                          }}
                          formatter={(value) => [
                            `${String(value ?? 0)} kcal`,
                            "Calories",
                          ]}
                        />
                        <Bar
                          dataKey="calories"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
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
                          tick={{ fontSize: 10 }}
                          interval="preserveStartEnd"
                          className="text-muted-foreground"
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          className="text-muted-foreground"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          labelFormatter={(_, payload) => {
                            if (payload?.[0]?.payload?.dateLabel) {
                              return payload[0].payload.dateLabel
                            }
                            return ""
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="protein"
                          name="Protein"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="carbs"
                          name="Carbs"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="fat"
                          name="Fat"
                          stroke="#eab308"
                          strokeWidth={2}
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
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-black tracking-tighter ${color}`}>
        {value}{unit}
      </p>
      <p className="text-[10px] font-medium text-muted-foreground/60 italic">
        Goal: {goal}{unit}
      </p>
    </div>
  )
}
