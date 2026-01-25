import { useState } from "react"
import { ChevronDown, ChevronRight, Trash2, LayoutTemplate } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MealEntryItem } from "./MealEntryItem"
import type { FoodItem } from "@/lib/types"

interface MealTemplateGroupProps {
  instanceId: string
  templateName: string
  entries: Array<{
    id: string
    foodId: string
    quantity: number
    mealType: any
    food?: FoodItem
  }>
  onUpdateQuantity: (id: string, quantity: number) => void
  onRemoveEntry: (id: string) => void
  onRemoveGroup: (instanceId: string) => void
}

export function MealTemplateGroup({
  instanceId,
  templateName,
  entries,
  onUpdateQuantity,
  onRemoveEntry,
  onRemoveGroup,
}: MealTemplateGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const totalCalories = entries.reduce((sum, e) => {
    return sum + (e.food ? e.food.calories * e.quantity : 0)
  }, 0)

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <LayoutTemplate className="h-4 w-4 text-primary shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-medium truncate">{templateName}</span>
            <span className="text-xs text-muted-foreground">
              {entries.length} items • {Math.round(totalCalories)} Cal
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-destructive hover:bg-destructive/10"
          onClick={(e) => {
            e.stopPropagation()
            onRemoveGroup(instanceId)
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {isExpanded && (
        <div className="border-t bg-muted/20 p-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
          {entries.map((entry) => {
            if (!entry.food) return null
            return (
              <MealEntryItem
                key={entry.id}
                entry={entry}
                food={entry.food}
                onUpdateQuantity={(q) => onUpdateQuantity(entry.id, q)}
                onRemove={() => onRemoveEntry(entry.id)}
                isExpanded={false} // Simplification: don't support expanding inner items for now, or handle state locally
                onToggleExpand={() => {}} // Optional: Implement if needed
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
