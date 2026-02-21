import { useState, useEffect, useCallback, memo } from "react"
import { Trash2, Plus, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { FoodItem } from "@/lib/types"

interface MealEntryItemProps {
  entry: { id: string; quantity: number }
  food: FoodItem
  onRemove: () => void
  onEdit?: () => void
  onUpdateQuantity?: (quantity: number) => void
  className?: string
  isNested?: boolean
}

const QUANTITY_STEP = 0.25
const MIN_QUANTITY = 0.25

export const MealEntryItem = memo(({
  entry,
  food,
  onRemove,
  onEdit,
  onUpdateQuantity,
  className,
  isNested,
}: MealEntryItemProps) => {
  const [quantity, setQuantity] = useState(entry.quantity)

  // Sync local state when entry changes
  useEffect(() => {
    setQuantity(Math.round(entry.quantity * 100) / 100)
  }, [entry.quantity])

  const adjustedCalories = Math.round(food.calories * quantity)

  const handleRemove = useCallback((e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation()
    onRemove()
  }, [onRemove])

  const handleEdit = useCallback((e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation()
    onEdit?.()
  }, [onEdit])

  const handleIncrement = useCallback((e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation()
    const newQty = Math.round((quantity + QUANTITY_STEP) * 100) / 100
    setQuantity(newQty)
    onUpdateQuantity?.(newQty)
  }, [quantity, onUpdateQuantity])

  const handleDecrement = useCallback((e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation()
    const newQty = Math.max(MIN_QUANTITY, Math.round((quantity - QUANTITY_STEP) * 100) / 100)
    setQuantity(newQty)
    onUpdateQuantity?.(newQty)
  }, [quantity, onUpdateQuantity])

  const displayQuantity = Math.round(quantity * 100) / 100
  const editProps = onEdit
    ? {
      onClick: handleEdit,
      onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleEdit()
        }
      },
      role: "button" as const,
      tabIndex: 0,
    }
    : {}

  return (
    <div className={cn(
      "overflow-hidden transition-colors",
      !isNested && "rounded-lg border border-border/20",
      className
    )}>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 outline-none focus-visible:bg-muted/70",
          onEdit ? "cursor-pointer hover:bg-muted/70" : ""
        )}
        {...editProps}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{food.name}</p>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-tight">
            {food.servingSize} • <span className="text-primary font-bold">{adjustedCalories} Cal</span>
          </p>
        </div>

        {onUpdateQuantity && (
          <div 
            className="flex items-center bg-background/50 rounded-full border border-border/10 p-0.5 mx-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <Button
              size="icon-xs"
              variant="ghost"
              className="h-6 w-6 rounded-full"
              onClick={handleDecrement}
              disabled={quantity <= MIN_QUANTITY}
              aria-label={`Decrease quantity for ${food.name}`}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-8 text-center text-[10px] font-black">{displayQuantity}</span>
            <Button
              size="icon-xs"
              variant="ghost"
              className="h-6 w-6 rounded-full"
              onClick={handleIncrement}
              aria-label={`Increase quantity for ${food.name}`}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
        
        {!onEdit && <div className="w-7 shrink-0" />}

        <Button
          size="icon-sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleRemove}
          aria-label={`Remove ${food.name}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
})

MealEntryItem.displayName = "MealEntryItem"
