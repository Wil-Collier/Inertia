import { useEffect, useState } from "react"
import { Minus, Plus, Save } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { FoodItem, MealEntry } from "@/lib/types"

interface EditFoodSheetProps {
  isOpen: boolean
  onClose: () => void
  onSave: (quantity: number) => Promise<void>
  entry: MealEntry | null
  food: FoodItem | null
}

export function EditFoodSheet({
  isOpen,
  onClose,
  onSave,
  entry,
  food,
}: EditFoodSheetProps) {
  const [quantity, setQuantity] = useState<number | string>(1)

  // Sync local state when entry changes
  useEffect(() => {
    if (entry) {
      setQuantity(Math.round(entry.quantity * 100) / 100)
    }
  }, [entry, isOpen])

  const handleIncrement = () => {
    setQuantity((q) => {
      const current = typeof q === "string" ? parseFloat(q) || 0 : q
      return Math.round((Math.floor(current * 10 + 0.01) / 10 + 0.1) * 10) / 10
    })
  }

  const handleDecrement = () => {
    setQuantity((q) => {
      const current = typeof q === "string" ? parseFloat(q) || 0 : q
      return Math.max(0.1, Math.round((Math.ceil(current * 10 - 0.01) / 10 - 0.1) * 10) / 10)
    })
  }

  const handleSave = async () => {
    const finalQuantity = typeof quantity === "string" ? parseFloat(quantity) : quantity
    if (finalQuantity === undefined || isNaN(finalQuantity)) return
    const roundedQuantity = Math.round(finalQuantity * 100) / 100
    await onSave(roundedQuantity)
    onClose()
  }

  if (!entry || !food) return null

  // Calculate totals
  const rawQuantity = typeof quantity === "string" ? parseFloat(quantity) || 0 : quantity
  const displayQuantity = Math.round(rawQuantity * 100) / 100
  const totalCalories = Math.round(food.calories * displayQuantity)
  const totalProtein = Math.round(food.protein * displayQuantity * 10) / 10
  const totalCarbs = Math.round(food.carbs * displayQuantity * 10) / 10
  const totalFat = Math.round(food.fat * displayQuantity * 10) / 10

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom">
        <SheetHeader className="px-4 border-b pb-4">
          <SheetTitle className="uppercase tracking-tight text-primary font-black">
            Edit {food.name}
          </SheetTitle>
        </SheetHeader>

        <div className="py-6 px-4 space-y-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quantity</Label>
                <p className="text-sm font-medium">
                  {food.servingSize}
                </p>
              </div>
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/50">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleDecrement}
                  disabled={displayQuantity <= 0.1}
                  className="h-8 w-8 rounded-md"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-16 h-8 border-none bg-transparent text-center text-sm font-bold font-mono focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  step="0.01"
                  min="0.1"
                />
                <Button variant="ghost" size="icon-sm" onClick={handleIncrement} className="h-8 w-8 rounded-md">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Nutritional Totals
            </h4>
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-muted/30 p-3">
                <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Calories</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-lg font-black font-mono leading-none">{totalCalories}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-muted/30 p-3">
                <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Protein</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-lg font-black font-mono leading-none">{totalProtein}</span>
                  <span className="text-[8px] font-bold text-muted-foreground">G</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-muted/30 p-3">
                <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Carbs</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-lg font-black font-mono leading-none">{totalCarbs}</span>
                  <span className="text-[8px] font-bold text-muted-foreground">G</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-muted/30 p-3">
                <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Fat</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-lg font-black font-mono leading-none">{totalFat}</span>
                  <span className="text-[8px] font-bold text-muted-foreground">G</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <Button className="w-full h-12 text-sm font-bold uppercase tracking-widest" size="lg" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
