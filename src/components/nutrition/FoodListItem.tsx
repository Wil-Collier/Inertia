import { useCallback, memo } from "react"
import { Star, Trash2, Plus } from "lucide-react"
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

export const FoodListItem = memo(({
  food,
  onAdd,
  onToggleFavorite,
  isFavorite,
  onDelete,
  showDelete,
}: FoodListItemProps) => {
  const handleAdd = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onAdd(1)
  }, [onAdd])

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
      <div className="flex items-center gap-3 p-3">
        <div className="flex-1">
          <p className="font-medium">{food.name}</p>
          {food.brand && (
            <p className="text-xs text-muted-foreground">{food.brand}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {food.servingSize} • {food.calories} Cal
          </p>
          <p className="text-xs text-muted-foreground">
            P: {food.protein}g • C: {food.carbs}g • F: {food.fat}g
          </p>
        </div>
        
        <div className="flex items-center gap-1">
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

          <Button
            size="icon-sm"
            variant="secondary"
            className="h-8 w-8 rounded-full ml-1"
            onClick={handleAdd}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
})

FoodListItem.displayName = "FoodListItem"

