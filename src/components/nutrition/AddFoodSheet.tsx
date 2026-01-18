import { useState } from "react"
import { Search, X, ScanBarcode, Loader2, Bookmark, Trash2, Check } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FoodListItem } from "./FoodListItem"
import { CustomFoodForm } from "./CustomFoodForm"
import type { FoodItem, MealEntry } from "@/lib/types"

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
  onScanBarcode: () => void
  onAddFood: (food: FoodItem, qty: number) => Promise<void>
  onToggleFavorite: (foodId: string) => Promise<void>
  onDeleteFood: (foodId: string) => Promise<void>
  favorites: FoodItem[]
  customFoods: FoodItem[]
  mealTemplates: Array<{
    id: string
    name: string
    entries: Omit<MealEntry, "id">[]
  }>
  scannedBarcode: string | null
  onClearBarcode: () => void
  onSaveCustomFood: (food: Omit<FoodItem, "id" | "isCustom">) => void
  onSaveAndAddCustomFood: (food: Omit<FoodItem, "id" | "isCustom">) => void
  onDeleteTemplate: (id: string) => Promise<void>
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
  const [expandedFoodId, setExpandedFoodId] = useState<string | null>(null)

  const handleToggleExpand = (id: string) => {
    setExpandedFoodId(current => current === id ? null : id)
  }

  // Reset expanded state when active tab changes or search query changes
  // to avoid confusion or stuck states
  // Although preserving it might be nice, standard behavior is usually reset
  // Let's keep it simple first. 

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh]">
        <SheetHeader>
          <SheetTitle>
            Add to {selectedMealLabel}
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4 px-4">
          <TabsList className="w-full">
            <TabsTrigger value="search" className="flex-1">
              Search
            </TabsTrigger>
            <TabsTrigger value="myfoods" className="flex-1">
              My Foods
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex-1">
              Favorites
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex-1">
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search foods..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={onScanBarcode}
                disabled={isLookingUp}
                title="Scan barcode"
              >
                {isLookingUp ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanBarcode className="h-4 w-4" />
                )}
              </Button>
            </div>

            <ScrollArea className="mt-4 h-[50vh]">
              {isSearching || isLookingUp ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {isLookingUp ? "Looking up product..." : "Searching..."}
                </p>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((food) => (
                    <FoodListItem
                      key={food.id}
                      food={food}
                      onAdd={(qty) => onAddFood(food, qty)}
                      onToggleFavorite={() => onToggleFavorite(food.id)}
                      isFavorite={food.isFavorite}
                      isExpanded={expandedFoodId === food.id}
                      onToggleExpand={() => handleToggleExpand(food.id)}
                    />
                  ))}
                </div>
              ) : searchQuery ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No results found
                </p>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Search for foods using the Open Food Facts database
                </p>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="myfoods" className="mt-4">
            <ScrollArea className="h-[55vh]">
              <div className="space-y-3">
                <CustomFoodForm
                  onSave={onSaveCustomFood}
                  onSaveAndAdd={onSaveAndAddCustomFood}
                  initialBarcode={scannedBarcode}
                  onClearBarcode={onClearBarcode}
                />
                
                {customFoods.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-sm font-medium text-muted-foreground">Saved Foods</p>
                    {customFoods.map((food) => (
                      <FoodListItem
                        key={food.id}
                        food={food}
                        onAdd={(qty) => onAddFood(food, qty)}
                        onToggleFavorite={() => onToggleFavorite(food.id)}
                        isFavorite={food.isFavorite}
                        onDelete={() => onDeleteFood(food.id)}
                        showDelete
                        isExpanded={expandedFoodId === food.id}
                        onToggleExpand={() => handleToggleExpand(food.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="favorites" className="mt-4">
            <ScrollArea className="h-[55vh]">
              {favorites.length > 0 ? (
                <div className="space-y-2">
                  {favorites.map((food) => (
                    <FoodListItem
                      key={food.id}
                      food={food}
                      onAdd={(qty) => onAddFood(food, qty)}
                      onToggleFavorite={() => onToggleFavorite(food.id)}
                      isFavorite={true}
                      isExpanded={expandedFoodId === food.id}
                      onToggleExpand={() => handleToggleExpand(food.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No favorites yet. Star foods to add them here!
                </p>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <ScrollArea className="h-[55vh]">
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
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => onDeleteTemplate(template.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {template.entries.length} items
                        </p>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => onApplyTemplate(template.id)}
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
                    Add foods to a meal, then tap "Save as Template"
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
