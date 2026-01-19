import { useState } from "react"
import { Plus, BookmarkPlus, type LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MealEntryItem } from "./MealEntryItem"
import type { MealType, FoodItem } from "@/lib/types"

interface MealLoggerProps {
  mealTypes: { type: MealType; label: string; icon: LucideIcon }[]
  getEntriesByMealType: (type: MealType) => Array<{
    id: string
    foodId: string
    quantity: number
    mealType: MealType
    food?: FoodItem
  }>
  openAddSheet: (mealType: MealType) => void
  onUpdateQuantity: (id: string, quantity: number) => Promise<void>
  onRemoveEntry: (id: string) => Promise<void>
  onSaveTemplate: (type: MealType, label: string) => void
}

export function MealLogger({
  mealTypes,
  getEntriesByMealType,
  openAddSheet,
  onUpdateQuantity,
  onRemoveEntry,
  onSaveTemplate,
}: MealLoggerProps) {
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)

  const handleToggleExpand = (id: string) => {
    setExpandedEntryId(current => current === id ? null : id)
  }

  return (
    <div className="space-y-4">
      {mealTypes.map(({ type, label, icon: Icon }) => {
        const entries = getEntriesByMealType(type)
        const mealCalories = entries.reduce((sum, e) => {
          return sum + (e.food ? e.food.calories * e.quantity : 0)
        }, 0)

        return (
          <Card key={type} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <Icon className="h-4 w-4 text-primary" />
                {label}
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black">
                  {Math.round(mealCalories)} <span className="text-xxs font-bold text-muted-foreground uppercase tracking-tighter">Cal</span>
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-8 w-8 rounded-full bg-background/50"
                  onClick={() => openAddSheet(type)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            {entries.length > 0 && (
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {entries.map((entry) => {
                    if (!entry.food) return null

                    return (
                      <MealEntryItem
                        key={entry.id}
                        entry={entry}
                        food={entry.food}
                        onUpdateQuantity={(quantity) => onUpdateQuantity(entry.id, quantity)}
                        onRemove={() => onRemoveEntry(entry.id)}
                        isExpanded={expandedEntryId === entry.id}
                        onToggleExpand={() => handleToggleExpand(entry.id)}
                      />
                    )
                  })}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full text-xs text-muted-foreground"
                  onClick={() => onSaveTemplate(type, label)}
                >
                  <BookmarkPlus className="mr-1 h-3 w-3" />
                  Save as Template
                </Button>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
