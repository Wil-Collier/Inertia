import { useState } from "react"
import { Scale, TrendingUp, TrendingDown, Minus, Plus, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useBodyWeightHistory } from "@/features/bodyweight/queries"
import { useAddWeightEntry } from "@/features/bodyweight/mutations"
import { getToday } from "@/lib/dateUtils"
import { useWeightUnit } from "@/hooks/useUnits"
import { getDisplayWeight } from "@/lib/conversions"
import { Link } from "@tanstack/react-router"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export function WeightCard() {
  const addWeightEntryMutation = useAddWeightEntry()
  const { data: weightEntries = [] } = useBodyWeightHistory(2)
  const weightUnit = useWeightUnit()
  const [isOpen, setIsOpen] = useState(false)
  const [weight, setWeight] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  
  const latestEntry = weightEntries[0]
  const previousEntry = weightEntries[1]

  // Entries are stored in lbs — compute change in display unit
  const latestDisplay = latestEntry ? getDisplayWeight(latestEntry.weight, weightUnit.unit) : null
  const previousDisplay = previousEntry ? getDisplayWeight(previousEntry.weight, weightUnit.unit) : null
  const weightChange = latestDisplay !== null && previousDisplay !== null
    ? latestDisplay - previousDisplay
    : 0

  const handleSave = async () => {
    const val = parseFloat(weight)
    if (isNaN(val) || val <= 0) {
      toast.error("Please enter a valid weight")
      return
    }
    
    try {
      setIsLoading(true)
      // Convert user-entered display-unit value to lbs for canonical storage
      const weightInLbs = weightUnit.parse(val)
      await addWeightEntryMutation.mutateAsync({ weight: weightInLbs, date: getToday() })
      setWeight("")
      setIsOpen(false)
    } catch {
      // Error is handled by mutation
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4">
          <Link to="/progress" className="flex items-center gap-3 flex-1 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-category-bodyweight/10 text-category-bodyweight group-hover:bg-category-bodyweight/20 transition-colors">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Body Weight</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">
                  {latestDisplay !== null ? weightUnit.format(latestEntry.weight, { shouldShowUnit: false }) : "--"}
                </span>
                <span className="text-xs text-muted-foreground">{weightUnit.unitLabel}</span>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              {latestDisplay !== null && previousDisplay !== null && (
                <div className="flex items-center gap-1 text-xs">
                  {weightChange > 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-trend-negative" />
                      <span className="text-trend-negative">+{weightChange.toFixed(1)}</span>
                    </>
                  ) : weightChange < 0 ? (
                    <>
                      <TrendingDown className="h-3 w-3 text-trend-positive" />
                      <span className="text-trend-positive">{weightChange.toFixed(1)}</span>
                    </>
                  ) : (
                    <>
                      <Minus className="h-3 w-3 text-muted-foreground" />
                      <span>0.0</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger render={
                <Button size="icon-sm" variant="outline" className="rounded-full shadow-sm">
                  <Plus className="h-4 w-4" />
                </Button>
              } />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Body Weight</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="text-lg py-6 pr-12"
                      disabled={isLoading}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                      {weightUnit.unitLabel}
                    </span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>Cancel</Button>
                  <Button onClick={() => void handleSave()} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Weight
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
