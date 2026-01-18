import { Beef, Wheat, Droplets, Leaf, Candy, Flame, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { MacroBar } from "./MacroBar"

interface MacroSummaryProps {
  totals: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    sugar: number
  } | undefined
  goals: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    sugar: number
  }
}

export function MacroSummary({ totals, goals }: MacroSummaryProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-5xl font-black tracking-tighter">{Math.round(totals?.calories ?? 0)}</p>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Calories Consumed
              </p>
              {(totals?.calories ?? 0) > goals.calories && (
                <TrendingUp className="h-3 w-3 text-trend-negative" />
              )}
            </div>
            <p className="text-xs font-medium text-muted-foreground/60 italic">
              Daily Goal: {goals.calories} kcal
            </p>
          </div>
          <div className="relative h-24 w-24">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90 drop-shadow-sm">
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                className="text-muted/50"
              />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeDasharray={`${goals.calories > 0 ? Math.min(
                  ((totals?.calories ?? 0) / goals.calories) * 100,
                  100
                ) : 0} 100`}
                strokeLinecap="round"
                className="text-calories transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Flame className="h-8 w-8 text-calories/20" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <MacroBar
            label="Protein"
            value={totals?.protein ?? 0}
            goal={goals.protein}
            color="bg-macro-protein"
            icon={Beef}
          />
          <MacroBar
            label="Carbs"
            value={totals?.carbs ?? 0}
            goal={goals.carbs}
            color="bg-macro-carbs"
            icon={Wheat}
          />
          <MacroBar
            label="Fat"
            value={totals?.fat ?? 0}
            goal={goals.fat}
            color="bg-macro-fat"
            icon={Droplets}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <MacroBar
            label="Fiber"
            value={totals?.fiber ?? 0}
            goal={goals.fiber}
            color="bg-macro-fiber"
            icon={Leaf}
          />
          <MacroBar
            label="Sugar"
            value={totals?.sugar ?? 0}
            goal={goals.sugar}
            color="bg-macro-sugar"
            icon={Candy}
          />
        </div>
      </CardContent>
    </Card>
  )
}
