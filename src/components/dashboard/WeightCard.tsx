import { useState } from "react"
import { Scale, TrendingUp, TrendingDown, Minus, Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useBodyWeightStore, getTodayDate } from "@/stores/bodyWeightStore"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { Link } from "react-router-dom"
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
  const { getAllEntriesSorted, addEntry } = useBodyWeightStore()
  const weightUnit = useWeightUnit()
  const [open, setOpen] = useState(false)
  const [weight, setWeight] = useState("")
  
  const sortedEntries = getAllEntriesSorted()
  const latestEntry = sortedEntries[0]
  const previousEntry = sortedEntries[1]
  
  const weightChange = latestEntry && previousEntry 
    ? latestEntry.weight - previousEntry.weight 
    : 0

  const handleSave = () => {
    const val = parseFloat(weight)
    if (isNaN(val) || val <= 0) {
      toast.error("Please enter a valid weight")
      return
    }
    
    addEntry(val, getTodayDate())
    toast.success("Weight logged successfully!")
    setWeight("")
    setOpen(false)
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4">
          <Link to="/progress" className="flex items-center gap-3 flex-1 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-colors">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Body Weight</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">
                  {latestEntry ? weightUnit.format(latestEntry.weight, { showUnit: false }) : "--"}
                </span>
                <span className="text-xs text-muted-foreground">{weightUnit.unitLabel}</span>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              {latestEntry && previousEntry && (
                <div className="flex items-center gap-1 text-xs">
                  {weightChange > 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-red-500" />
                      <span className="text-red-500">+{weightChange.toFixed(1)}</span>
                    </>
                  ) : weightChange < 0 ? (
                    <>
                      <TrendingDown className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">{weightChange.toFixed(1)}</span>
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

            <Dialog open={open} onOpenChange={setOpen}>
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
                      autoFocus
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                      {weightUnit.unitLabel}
                    </span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave}>Save Weight</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
