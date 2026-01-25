import { useState, useEffect, useCallback, memo } from "react"
import { Trash2, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { FoodItem } from "@/lib/types"

interface MealEntryItemProps {
  entry: { id: string; quantity: number }
  food: FoodItem
  onRemove: () => void
  onEdit?: () => void
  className?: string
  isNested?: boolean
}

export const MealEntryItem = memo(({
  entry,
  food,
  onRemove,
  onEdit,
  className,
  isNested,
}: MealEntryItemProps) => {
  const [quantity, setQuantity] = useState(entry.quantity)

  // Sync local state when entry changes
  useEffect(() => {
    setQuantity(entry.quantity)
  }, [entry.quantity])

  const adjustedCalories = Math.round(food.calories * quantity)

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onRemove()
  }, [onRemove])

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit?.()
  }, [onEdit])

  return (
    <div className={cn(
      "overflow-hidden transition-colors",
      !isNested && "rounded-lg border border-border/20",
      className
    )}>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          onEdit ? "cursor-pointer hover:bg-muted/70" : ""
        )}
        onClick={onEdit}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{food.name}</p>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-tight">
            {quantity !== 1 ? `${quantity}x ` : ""}
            {food.servingSize} • <span className="text-primary font-bold">{adjustedCalories} Cal</span>
          </p>
        </div>
        
        {onEdit ? (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleEdit}
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </Button>
        ) : (
          <div className="w-7 shrink-0" />
        )}

        <Button
          size="icon-sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
})

MealEntryItem.displayName = "MealEntryItem"
