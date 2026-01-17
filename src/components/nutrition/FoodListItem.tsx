import { useState } from "react"
import { Star, Trash2, Plus, Minus, Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
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

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
    if (!isExpanded) {
      setQuantity(1)
    }
  }

  const incrementQuantity = (e: React.MouseEvent) => {
    e.stopPropagation()
    setQuantity((q) => Math.round((q + 0.5) * 10) / 10)
  }

  const decrementQuantity = (e: React.MouseEvent) => {
    e.stopPropagation()
    setQuantity((q) => Math.max(0.5, Math.round((q - 0.5) * 10) / 10))
  }

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    onAdd(quantity)
    setIsExpanded(false)
    setQuantity(1)
  }

  return (
    <div className={cn(
      "rounded-xl border transition-all duration-200 overflow-hidden",
      isExpanded ? "border-primary shadow-sm bg-primary/[0.01]" : "bg-card hover:bg-muted/50"
    )}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={handleToggleExpand}
      >
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{food.name}</p>
          {food.brand && (
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{food.brand}</p>
          )}
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-black italic text-primary">
              {food.calories} <span className="text-[9px] font-bold text-muted-foreground uppercase not-italic tracking-tighter">kcal</span>
            </span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase ml-1">{food.servingSize}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 border-l pl-2">
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              onToggleFavorite()
            }}
          >
            <Star
              className={cn("h-4 w-4", isFavorite && "fill-yellow-500 text-yellow-500")}
            />
          </Button>
          {showDelete && onDelete && (
            <Button
              size="icon-sm"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200 ml-1",
              isExpanded && "rotate-180 text-primary"
            )}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 pt-0 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="rounded-lg bg-muted/30 border border-primary/10 p-4 space-y-4">
            {/* Quantity Selector */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Number of Servings</span>
              <div className="flex items-center gap-3">
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="h-8 w-8 rounded-full"
                  onClick={decrementQuantity}
                  disabled={quantity <= 0.5}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-8 text-center font-black italic text-lg">{quantity}</span>
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="h-8 w-8 rounded-full bg-primary/5 border-primary/20"
                  onClick={incrementQuantity}
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                </Button>
              </div>
            </div>

            {/* Total Calories Display */}
            <div className="flex items-center justify-center py-2">
              <span className="text-4xl font-black italic tracking-tighter text-primary">
                {adjustedCalories} <span className="text-sm font-bold text-muted-foreground uppercase not-italic tracking-tighter">kcal</span>
              </span>
            </div>

            {/* Macro Ribbon */}
            <div className="flex divide-x border border-primary/10 rounded-lg overflow-hidden bg-background/40">
              <div className="flex-1 flex flex-col items-center py-1.5">
                <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">Prot</span>
                <span className="text-xs font-black italic">{adjustedProtein}g</span>
              </div>
              <div className="flex-1 flex flex-col items-center py-1.5">
                <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">Carb</span>
                <span className="text-xs font-black italic">{adjustedCarbs}g</span>
              </div>
              <div className="flex-1 flex flex-col items-center py-1.5">
                <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">Fat</span>
                <span className="text-xs font-black italic">{adjustedFat}g</span>
              </div>
              <div className="flex-1 flex flex-col items-center py-1.5">
                <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">Fib</span>
                <span className="text-xs font-black italic text-muted-foreground/80">{adjustedFiber}g</span>
              </div>
              <div className="flex-1 flex flex-col items-center py-1.5">
                <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">Sug</span>
                <span className="text-xs font-black italic text-muted-foreground/80">{adjustedSugar}g</span>
              </div>
            </div>

            {/* Add Button */}
            <Button className="w-full font-black uppercase italic tracking-widest h-10" onClick={handleAdd}>
              <Check className="mr-2 h-4 w-4" />
              Add to Meal
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
