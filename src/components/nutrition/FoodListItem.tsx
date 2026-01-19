import { useState, useCallback, memo } from "react"
import { Star, Trash2, Plus, Minus, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { FoodItem } from "@/lib/types"

interface FoodListItemProps {
  food: FoodItem
  onAdd: (quantity: number) => void
  onToggleFavorite: () => void
  isFavorite?: boolean
  onDelete?: () => void
  showDelete?: boolean
  isExpanded: boolean
  onToggleExpand: () => void
}

export const FoodListItem = memo(({
  food,
  onAdd,
  onToggleFavorite,
  isFavorite,
  onDelete,
  showDelete,
  isExpanded,
  onToggleExpand,
}: FoodListItemProps) => {
  const [quantity, setQuantity] = useState(1)

  const adjustedCalories = Math.round(food.calories * quantity)
  const adjustedProtein = Math.round(food.protein * quantity * 10) / 10
  const adjustedCarbs = Math.round(food.carbs * quantity * 10) / 10
  const adjustedFat = Math.round(food.fat * quantity * 10) / 10
  const adjustedFiber = Math.round((food.fiber ?? 0) * quantity * 10) / 10
  const adjustedSugar = Math.round((food.sugar ?? 0) * quantity * 10) / 10

  const handleToggleExpand = useCallback(() => {
    onToggleExpand()
    if (!isExpanded) {
      setQuantity(1)
    }
  }, [isExpanded, onToggleExpand])

  const handleIncrementQuantity = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setQuantity((q) => Math.round((q + 0.5) * 10) / 10)
  }, [])

  const handleDecrementQuantity = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setQuantity((q) => Math.max(0.5, Math.round((q - 0.5) * 10) / 10))
  }, [])

  const handleAdd = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onAdd(quantity)
    onToggleExpand()
    setQuantity(1)
  }, [onAdd, quantity, onToggleExpand])

  const handleToggleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleFavorite()
  }, [onToggleFavorite])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete?.()
  }, [onDelete])

  return (
    <div className="rounded-lg border overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
        onClick={handleToggleExpand}
      >
        <div className="flex-1">
          <p className="font-medium">{food.name}</p>
          {food.brand && (
            <p className="text-xs text-muted-foreground">{food.brand}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {food.calories} Cal • P: {food.protein}g • C: {food.carbs}g • F:{" "}
            {food.fat}g
          </p>
          <p className="text-xs text-muted-foreground">{food.servingSize}</p>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={handleToggleFavorite}
        >
          <Star
            className={`h-4 w-4 ${isFavorite ? "fill-favorite text-favorite" : ""}`}
          />
        </Button>
        {showDelete && onDelete && (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className={cn(
            "border-t bg-muted/30 p-3 space-y-3 transition-transform duration-300 ease-in-out",
            isExpanded ? "translate-y-0" : "-translate-y-2"
          )}>
            {/* Quantity Selector */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Servings</span>
              <div className="flex items-center gap-2">
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={handleDecrementQuantity}
                  disabled={quantity <= 0.5}
                  tabIndex={isExpanded ? 0 : -1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={handleIncrementQuantity}
                  tabIndex={isExpanded ? 0 : -1}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Adjusted Macros */}
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{adjustedCalories} Cal</span>
              {" • "}P: {adjustedProtein}g • C: {adjustedCarbs}g • F: {adjustedFat}g
              <br />
              Fiber: {adjustedFiber}g • Sugar: {adjustedSugar}g
            </div>

            {/* Add Button */}
            <Button className="w-full" onClick={handleAdd} tabIndex={isExpanded ? 0 : -1}>
              <Check className="mr-2 h-4 w-4" />
              Add {quantity > 1 ? `${quantity} servings` : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
})

FoodListItem.displayName = "FoodListItem"

