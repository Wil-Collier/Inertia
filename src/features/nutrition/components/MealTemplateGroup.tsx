import { useState } from "react"
import { ChevronDown, Trash2, Bookmark } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MealEntryItem } from "./MealEntryItem"
import type { FoodItem, NutritionMealEntry } from "@/lib/types"

interface MealTemplateGroupProps {
  instanceId: string
  templateName: string
  entries: Array<NutritionMealEntry & { food?: FoodItem }>
  onEditEntry: (entry: NutritionMealEntry, food: FoodItem) => void
  onRemoveEntry: (id: string) => void
  onRemoveGroup: (instanceId: string) => void
  onUpdateQuantity: (id: string, quantity: number) => void
}

export function MealTemplateGroup({
  instanceId,
  templateName,
  entries,
  onEditEntry,
  onRemoveEntry,
  onRemoveGroup,
  onUpdateQuantity,
}: MealTemplateGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const totalCalories = entries.reduce((sum, e) => {
    return sum + (e.food ? e.food.calories * e.quantity : 0)
  }, 0)

  return (
    <div className="rounded-lg bg-muted/50 shadow-sm overflow-hidden border border-border/20">
      <div 
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/70 transition-colors outline-none focus-visible:bg-muted/70"
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setIsExpanded(!isExpanded)
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-primary shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold truncate">{templateName}</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-tight">
              {entries.length} items • <span className="text-primary font-bold">{Math.round(totalCalories)} Cal</span>
            </span>
          </div>
        </div>
        
        <div className="w-7 shrink-0 flex items-center justify-center">
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onRemoveGroup(instanceId)
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className={cn(
            "border-t border-border/50 bg-muted/20 py-1 space-y-1 transition-transform duration-300 ease-in-out",
            isExpanded ? "translate-y-0" : "-translate-y-2"
          )}>
            {entries.map((entry) => {
              if (!entry.food) return null
              return (
                 <MealEntryItem
                  key={entry.id}
                  entry={entry}
                  food={entry.food}
                  onRemove={() => onRemoveEntry(entry.id)}
                  onEdit={() => onEditEntry(entry, entry.food!)}
                  onUpdateQuantity={(qty) => onUpdateQuantity(entry.id, qty)}
                  isNested
                  className="bg-transparent border-0 rounded-none hover:bg-muted/30"
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
