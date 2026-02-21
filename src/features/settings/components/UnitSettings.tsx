import { Ruler } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { WeightUnit, DistanceUnit } from "@/lib/types"

interface UnitSettingsProps {
  weightUnit: WeightUnit
  distanceUnit: DistanceUnit
  onWeightUnitChange: (unit: WeightUnit) => void
  onDistanceUnitChange: (unit: DistanceUnit) => void
}

export function UnitSettings({
  weightUnit,
  distanceUnit,
  onWeightUnitChange,
  onDistanceUnitChange,
}: UnitSettingsProps) {
  const weightUnitOptions: { value: WeightUnit; label: string }[] = [
    { value: "lbs", label: "Pounds (lbs)" },
    { value: "kg", label: "Kilograms (kg)" },
  ]

  const distanceUnitOptions: { value: DistanceUnit; label: string }[] = [
    { value: "mi", label: "Miles (mi)" },
    { value: "km", label: "Kilometers (km)" },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Ruler className="h-4 w-4" />
          Units
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Weight</Label>
          <div className="flex gap-2">
            {weightUnitOptions.map(({ value, label }) => (
              <Button
                key={value}
                variant={weightUnit === value ? "default" : "outline"}
                className="flex-1"
                onClick={() => onWeightUnitChange(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Used for body weight and workout weights
          </p>
        </div>

        <div className="space-y-2">
          <Label>Distance</Label>
          <div className="flex gap-2">
            {distanceUnitOptions.map(({ value, label }) => (
              <Button
                key={value}
                variant={distanceUnit === value ? "default" : "outline"}
                className="flex-1"
                onClick={() => onDistanceUnitChange(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Used for running, walking, and cardio distances
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
