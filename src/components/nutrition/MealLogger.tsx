import { useState } from "react"
import { Plus, type LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MealEntryItem } from "./MealEntryItem"
import { MealTemplateGroup } from "./MealTemplateGroup"
import { EditFoodSheet } from "./EditFoodSheet"
import type { MealType, FoodItem, MealEntry } from "@/lib/types"

interface MealLoggerProps {
  mealTypes: { type: MealType; label: string; icon: LucideIcon }[]
  getEntriesByMealType: (type: MealType) => Array<MealEntry & {
    food?: FoodItem
  }>
  openAddSheet: (mealType: MealType) => void
  onUpdateQuantity: (id: string, quantity: number) => Promise<void>
  onRemoveEntry: (id: string) => Promise<void>
  onRemoveGroup?: (instanceId: string) => Promise<void>
}

export function MealLogger({
  mealTypes,
  getEntriesByMealType,
  openAddSheet,
  onUpdateQuantity,
  onRemoveEntry,
  onRemoveGroup,
}: MealLoggerProps) {
  const [editingEntry, setEditingEntry] = useState<MealEntry | null>(null)
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null)

  const handleEditEntry = (entry: MealEntry, food: FoodItem) => {
    setEditingEntry(entry)
    setEditingFood(food)
  }

  const handleSaveEdit = async (quantity: number) => {
    if (editingEntry) {
      await onUpdateQuantity(editingEntry.id, quantity)
    }
  }

  return (
    <>
      <div className="space-y-4">
        {mealTypes.map(({ type, label, icon: Icon }) => {
          const entries = getEntriesByMealType(type)
          const mealCalories = entries.reduce((sum, e) => {
            return sum + (e.food ? e.food.calories * e.quantity : 0)
          }, 0)

          // Group entries
          const groups = new Map<string, { instanceId: string; templateName: string; entries: typeof entries }>()
          const looseEntries: typeof entries = []

          entries.forEach((entry) => {
            if (entry.templateInstanceId) {
              if (!groups.has(entry.templateInstanceId)) {
                groups.set(entry.templateInstanceId, {
                  instanceId: entry.templateInstanceId,
                  templateName: entry.templateName || "Template Meal",
                  entries: [],
                })
              }
              groups.get(entry.templateInstanceId)!.entries.push(entry)
            } else {
              looseEntries.push(entry)
            }
          })

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
                <CardContent className="pt-0 space-y-2 pb-4">
                  {/* Render Groups */}
                  {[...groups.values()].map((group) => (
                     <MealTemplateGroup
                      key={group.instanceId}
                      instanceId={group.instanceId}
                      templateName={group.templateName}
                      entries={group.entries}
                      onEditEntry={handleEditEntry}
                      onRemoveEntry={(id) => onRemoveEntry(id)}
                      onRemoveGroup={(id) => onRemoveGroup?.(id)}
                      onUpdateQuantity={onUpdateQuantity}
                    />
                  ))}

                  {/* Render Loose Entries */}
                  <div className="space-y-2">
                    {looseEntries.map((entry) => {
                      if (!entry.food) return null

                      return (
                        <MealEntryItem
                          key={entry.id}
                          entry={entry}
                          food={entry.food}
                          onRemove={() => onRemoveEntry(entry.id)}
                          onEdit={() => handleEditEntry(entry, entry.food!)}
                          onUpdateQuantity={(qty) => onUpdateQuantity(entry.id, qty)}
                          className="bg-muted/50"
                        />
                      )
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      <EditFoodSheet
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        onSave={handleSaveEdit}
        entry={editingEntry}
        food={editingFood}
      />
    </>
  )
}
