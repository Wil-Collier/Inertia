import { Bookmark, Trash2, Check, Plus, Pencil } from "lucide-react"
import { Link } from "@tanstack/react-router"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { TabsContent, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { FoodSearch } from "./FoodSearch"
import type { FoodItem, MealTemplateEntry } from "@/lib/types"

interface AddFoodSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedMealLabel: string | undefined
  activeTab: string
  setActiveTab: (tab: string) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  isSearching: boolean
  isLookingUp: boolean
  searchResults: FoodItem[]
  remoteStatus?: "idle" | "ok" | "error"
  remoteError?: string
  onScanBarcode: () => void
  onAddFood: (food: FoodItem, qty: number) => Promise<void>
  onToggleFavorite: (foodId: string) => Promise<void>
  onDeleteFood: (foodId: string) => Promise<void>
  favorites: FoodItem[]
  customFoods: FoodItem[]
  mealTemplates: Array<{
    id: string
    name: string
    entries: MealTemplateEntry[]
  }>
  scannedBarcode: string | null
  onClearBarcode: () => void
  onSaveCustomFood: (food: Omit<FoodItem, "id" | "isCustom">) => void
  onSaveAndAddCustomFood: (food: Omit<FoodItem, "id" | "isCustom">) => void
  onDeleteTemplate: (id: string) => void
  onApplyTemplate: (id: string) => Promise<void>
}

export function AddFoodSheet({
  isOpen,
  onOpenChange,
  selectedMealLabel,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  isSearching,
  isLookingUp,
  searchResults,
  remoteStatus,
  remoteError,
  onScanBarcode,
  onAddFood,
  onToggleFavorite,
  onDeleteFood,
  favorites,
  customFoods,
  mealTemplates,
  scannedBarcode,
  onClearBarcode,
  onSaveCustomFood,
  onSaveAndAddCustomFood,
  onDeleteTemplate,
  onApplyTemplate,
}: AddFoodSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle className="uppercase tracking-tight">
            Add to {selectedMealLabel}
          </SheetTitle>
        </SheetHeader>

        <FoodSearch
          className="mt-4 px-4 flex flex-col h-[calc(80vh-100px)]"
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          isSearching={isSearching}
          isLookingUp={isLookingUp}
          searchResults={searchResults}
          remoteStatus={remoteStatus}
          remoteError={remoteError}
          onScanBarcode={onScanBarcode}
          onAddFood={(food, qty) => void onAddFood(food, qty)}
          onToggleFavorite={(foodId) => void onToggleFavorite(foodId)}
          onDeleteFood={(foodId) => void onDeleteFood(foodId)}
          favorites={favorites}
          customFoods={customFoods}
          scannedBarcode={scannedBarcode}
          onClearBarcode={onClearBarcode}
          onSaveCustomFood={onSaveCustomFood}
          onSaveAndAddCustomFood={onSaveAndAddCustomFood}
          extraTabTriggers={
            <TabsTrigger value="templates" className="flex-1">
              Templates
            </TabsTrigger>
          }
          extraTabContents={
            <TabsContent value="templates" className="mt-4 flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="pb-[env(safe-area-inset-bottom,1rem)] space-y-4">
                  <Link to="/nutrition/template-editor" className="block">
                    <Button className="w-full" variant="outline" onClick={() => onOpenChange(false)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create New Template
                    </Button>
                  </Link>

                  {mealTemplates.length > 0 ? (
                    <div className="space-y-3">
                      {mealTemplates.map((template) => {
                        return (
                          <div
                            key={template.id}
                            className="rounded-lg border p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Bookmark className="h-4 w-4 text-primary" />
                                <span className="font-medium">{template.name}</span>
                              </div>
                              <div className="flex gap-1">
                                <Link
                                  to="/nutrition/template-editor"
                                  search={{ templateId: template.id }}
                                >
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={() => onOpenChange(false)}
                                  >
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                  </Button>
                                </Link>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  onClick={() => onDeleteTemplate(template.id)}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {template.entries.length} items
                            </p>
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => void onApplyTemplate(template.id)}
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Apply to {selectedMealLabel}
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Bookmark className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No templates yet
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Create one to quickly log common meals.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          }
        />
      </SheetContent>
    </Sheet>
  )
}
