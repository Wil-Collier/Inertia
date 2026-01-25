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
  const [quantity, setQuantity] = useState(1)

  // Sync local state when entry changes
  useEffect(() => {
    if (entry) {
      setQuantity(entry.quantity)
    }
  }, [entry, isOpen])

  const handleIncrement = () => {
    setQuantity((q) => Math.round((q + 0.5) * 10) / 10)
  }

  const handleDecrement = () => {
    setQuantity((q) => Math.max(0.5, Math.round((q - 0.5) * 10) / 10))
  }

  const handleSave = async () => {
    await onSave(quantity)
    onClose()
  }

  if (!entry || !food) return null

  // Calculate totals
  const totalCalories = Math.round(food.calories * quantity)
  const totalProtein = Math.round(food.protein * quantity * 10) / 10
  const totalCarbs = Math.round(food.carbs * quantity * 10) / 10
  const totalFat = Math.round(food.fat * quantity * 10) / 10

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom">
        <SheetHeader className="px-4">
          <SheetTitle>Edit {food.name}</SheetTitle>
        </SheetHeader>

        <div className="py-6 px-4 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base">Quantity</Label>
              <p className="text-sm text-muted-foreground">
                Serving size: {food.servingSize}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={handleDecrement}
                disabled={quantity <= 0.5}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-lg font-bold">
                {quantity}
              </span>
              <Button variant="outline" size="icon" onClick={handleIncrement}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-3">
            <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Totals
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-2xl font-black">{totalCalories}</span>
                <span className="text-xs text-muted-foreground ml-1 font-bold uppercase">
                  Cal
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Protein</span>
                  <span className="font-bold">{totalProtein}g</span>
                </div>
                <div className="flex justify-between">
                  <span>Carbs</span>
                  <span className="font-bold">{totalCarbs}g</span>
                </div>
                <div className="flex justify-between">
                  <span>Fat</span>
                  <span className="font-bold">{totalFat}g</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="px-4 pb-[env(safe-area-inset-bottom,1rem)]">
          <Button className="w-full" size="lg" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
