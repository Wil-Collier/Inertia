import { useState, useCallback } from "react"
import { Star, Trash2, Plus, Minus, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { FoodItem } from "@/lib/types"

interface FoodListItemProps {
  food: FoodItem
  onAdd: (quantity: number) => void
  onToggleFavorite: () => void
  isFavorite?: boolean
  onDelete?: () => void
  showDelete?: boolean
}

export function FoodListItem({
  food,
  onAdd,
  onToggleFavorite,
  isFavorite,
  onDelete,
  showDelete,
}: FoodListItemProps) {
  const [quantity, setQuantity] = useState(1)
  const [isExpanded, setIsExpanded] = useState(false)

  const adjustedCalories = Math.round(food.calories * quantity)
  const adjustedProtein = Math.round(food.protein * quantity * 10) / 10
  const adjustedCarbs = Math.round(food.carbs * quantity * 10) / 10
  const adjustedFat = Math.round(food.fat * quantity * 10) / 10
  const adjustedFiber = Math.round((food.fiber ?? 0) * quantity * 10) / 10
  const adjustedSugar = Math.round((food.sugar ?? 0) * quantity * 10) / 10

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(!isExpanded)
    if (!isExpanded) {
      setQuantity(1)
    }
  }, [isExpanded])

  const incrementQuantity = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setQuantity((q) => Math.round((q + 0.5) * 10) / 10)
  }, [])

  const decrementQuantity = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setQuantity((q) => Math.max(0.5, Math.round((q - 0.5) * 10) / 10))
  }, [])

  const handleAdd = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onAdd(quantity)
    setIsExpanded(false)
    setQuantity(1)
  }, [onAdd, quantity])

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
            {food.calories} kcal • P: {food.protein}g • C: {food.carbs}g • F:{" "}
            {food.fat}g
          </p>
          <p className="text-xs text-muted-foreground">{food.servingSize}</p>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
        >
          <Star
            className={`h-4 w-4 ${isFavorite ? "fill-yellow-500 text-yellow-500" : ""}`}
          />
        </Button>
        {showDelete && onDelete && (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="border-t bg-muted/30 p-3 space-y-3">
          {/* Quantity Selector */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Servings</span>
            <div className="flex items-center gap-2">
              <Button
                size="icon-sm"
                variant="outline"
                onClick={decrementQuantity}
                disabled={quantity <= 0.5}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={incrementQuantity}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Adjusted Macros */}
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{adjustedCalories} kcal</span>
            {" • "}P: {adjustedProtein}g • C: {adjustedCarbs}g • F: {adjustedFat}g
            <br />
            Fiber: {adjustedFiber}g • Sugar: {adjustedSugar}g
          </div>

          {/* Add Button */}
          <Button className="w-full" onClick={handleAdd}>
            <Check className="mr-2 h-4 w-4" />
            Add {quantity > 1 ? `${quantity} servings` : ""}
          </Button>
        </div>
      )}
    </div>
  )
}
