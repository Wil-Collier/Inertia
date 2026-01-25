import { useState } from "react"
import { ChevronDown, Trash2, Bookmark } from "lucide-react"
import { cn } from "@/lib/utils"
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
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)

  const handleToggleEntryExpand = (id: string) => {
    setExpandedEntryId((current) => (current === id ? null : id))
  }

  const totalCalories = entries.reduce((sum, e) => {
    return sum + (e.food ? e.food.calories * e.quantity : 0)
  }, 0)

  return (
    <div className="rounded-lg bg-muted/50 shadow-sm overflow-hidden">
      <div 
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/70 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
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
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-destructive hover:bg-destructive/10"
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
            "border-t border-border/50 bg-muted/30 p-2 space-y-2 transition-transform duration-300 ease-in-out",
            isExpanded ? "translate-y-0" : "-translate-y-2"
          )}>
            {entries.map((entry) => {
              if (!entry.food) return null
              return (
                <MealEntryItem
                  key={entry.id}
                  entry={entry}
                  food={entry.food}
                  onUpdateQuantity={(q) => onUpdateQuantity(entry.id, q)}
                  onRemove={() => onRemoveEntry(entry.id)}
                  isExpanded={expandedEntryId === entry.id}
                  onToggleExpand={() => handleToggleEntryExpand(entry.id)}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
