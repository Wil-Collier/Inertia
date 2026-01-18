import { useState, useEffect, useCallback, memo } from "react"
import { ChevronDown, Plus, Minus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { FoodItem } from "@/lib/types"

interface MealEntryItemProps {
  entry: { id: string; quantity: number }
  food: FoodItem
  onUpdateQuantity: (quantity: number) => void
  onRemove: () => void
}

export const MealEntryItem = memo(({
  entry,
  food,
  onUpdateQuantity,
  onRemove,
}: MealEntryItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [quantity, setQuantity] = useState(entry.quantity)

  // Sync local state when entry changes
  useEffect(() => {
    setQuantity(entry.quantity)
  }, [entry.quantity])

  const adjustedCalories = Math.round(food.calories * quantity)
  const adjustedProtein = Math.round(food.protein * quantity * 10) / 10
  const adjustedCarbs = Math.round(food.carbs * quantity * 10) / 10
  const adjustedFat = Math.round(food.fat * quantity * 10) / 10
  const adjustedFiber = Math.round((food.fiber ?? 0) * quantity * 10) / 10
  const adjustedSugar = Math.round((food.sugar ?? 0) * quantity * 10) / 10

  const handleIncrementQuantity = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const newQty = Math.round((quantity + 0.5) * 10) / 10
    setQuantity(newQty)
    onUpdateQuantity(newQty)
  }, [quantity, onUpdateQuantity])

  const handleDecrementQuantity = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const newQty = Math.max(0.5, Math.round((quantity - 0.5) * 10) / 10)
    setQuantity(newQty)
    onUpdateQuantity(newQty)
  }, [quantity, onUpdateQuantity])

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onRemove()
  }, [onRemove])

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(!isExpanded)
  }, [isExpanded])

  return (
    <div className="rounded-lg bg-muted/50 overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/70 transition-colors"
        onClick={handleToggleExpand}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{food.name}</p>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">
            {quantity !== 1 ? `${quantity}x ` : ""}
            {food.servingSize} • <span className="text-primary font-bold">{adjustedCalories} kcal</span>
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={handleRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {isExpanded && (
        <div className="border-t border-border/50 bg-muted/30 px-3 py-3 space-y-3">
          {/* Quantity Selector */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Servings</span>
            <div className="flex items-center gap-2">
              <Button
                size="icon-sm"
                variant="outline"
                onClick={handleDecrementQuantity}
                disabled={quantity <= 0.5}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={handleIncrementQuantity}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Macro Details */}
          <div className="rounded-md bg-background/50 p-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Calories</span>
                <span className="font-medium">{adjustedCalories} kcal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Protein</span>
                <span className="font-medium">{adjustedProtein}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Carbs</span>
                <span className="font-medium">{adjustedCarbs}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fat</span>
                <span className="font-medium">{adjustedFat}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fiber</span>
                <span className="font-medium">{adjustedFiber}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sugar</span>
                <span className="font-medium">{adjustedSugar}g</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

MealEntryItem.displayName = "MealEntryItem"

