import { Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { NutritionGoals } from "@/lib/types"

interface NutritionGoalSettingsProps {
  goals: NutritionGoals
  onGoalChange: (field: keyof NutritionGoals, value: number) => void
}

export function NutritionGoalSettings({ goals, onGoalChange }: NutritionGoalSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4" />
          Daily Nutrition Goals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Calories (Cal)</Label>
          <Input
            type="number"
            value={goals.calories}
            onChange={(e) => onGoalChange("calories", parseInt(e.target.value) || 0)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Protein (g)</Label>
            <Input
              type="number"
              value={goals.protein}
              onChange={(e) => onGoalChange("protein", parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>Carbs (g)</Label>
            <Input
              type="number"
              value={goals.carbs}
              onChange={(e) => onGoalChange("carbs", parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>Fat (g)</Label>
            <Input
              type="number"
              value={goals.fat}
              onChange={(e) => onGoalChange("fat", parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Fiber (g)</Label>
            <Input
              type="number"
              value={goals.fiber}
              onChange={(e) => onGoalChange("fiber", parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>Sugar (g)</Label>
            <Input
              type="number"
              value={goals.sugar}
              onChange={(e) => onGoalChange("sugar", parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
