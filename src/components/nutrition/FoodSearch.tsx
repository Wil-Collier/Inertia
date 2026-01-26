import { Search, X, ScanBarcode, Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FoodListItem } from "./FoodListItem"
import { CustomFoodForm } from "./CustomFoodForm"
import type { FoodItem } from "@/lib/types"

interface FoodSearchProps {
  activeTab: string
  onTabChange: (tab: string) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  isSearching: boolean
  isLookingUp: boolean
  searchResults: FoodItem[]
  onScanBarcode: () => void
  onAddFood: (food: FoodItem, qty: number) => void
  onToggleFavorite: (foodId: string) => void
  onDeleteFood: (foodId: string) => void
  favorites: FoodItem[]
  customFoods: FoodItem[]
  scannedBarcode: string | null
  onClearBarcode: () => void
  onSaveCustomFood: (food: Omit<FoodItem, "id" | "isCustom">) => void
  onSaveAndAddCustomFood: (food: Omit<FoodItem, "id" | "isCustom">) => void
  className?: string
  extraTabTriggers?: React.ReactNode
  extraTabContents?: React.ReactNode
}

export function FoodSearch({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchQueryChange,
  isSearching,
  isLookingUp,
  searchResults,
  onScanBarcode,
  onAddFood,
  onToggleFavorite,
  onDeleteFood,
  favorites,
  customFoods,
  scannedBarcode,
  onClearBarcode,
  onSaveCustomFood,
  onSaveAndAddCustomFood,
  className,
  extraTabTriggers,
  extraTabContents,
}: FoodSearchProps) {
  return (
    <div className={className}>
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
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
          {extraTabTriggers}
        </TabsList>

        <TabsContent value="search" className="mt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search foods..."
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => onSearchQueryChange("")}
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

          <ScrollArea className="mt-4 h-[calc(100vh-280px)] min-h-[300px]">
            <div className="pb-[env(safe-area-inset-bottom,1rem)]">
              {(isSearching || isLookingUp) && searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm">
                    {isLookingUp ? "Looking up product" : "Searching"}
                  </p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((food) => (
                    <FoodListItem
                      key={food.id}
                      food={food}
                      onAdd={(qty) => onAddFood(food, qty)}
                      onToggleFavorite={() => onToggleFavorite(food.id)}
                      isFavorite={food.isFavorite}
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
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="myfoods" className="mt-4">
          <ScrollArea className="h-[calc(100vh-220px)] min-h-[300px]">
            <div className="space-y-3 pb-[env(safe-area-inset-bottom,1rem)]">
              <CustomFoodForm
                onSave={onSaveCustomFood}
                onSaveAndAdd={onSaveAndAddCustomFood}
                initialBarcode={scannedBarcode}
                onClearBarcode={onClearBarcode}
              />

              {customFoods.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Saved Foods
                  </p>
                  {customFoods.map((food) => (
                    <FoodListItem
                      key={food.id}
                      food={food}
                      onAdd={(qty) => onAddFood(food, qty)}
                      onToggleFavorite={() => onToggleFavorite(food.id)}
                      isFavorite={food.isFavorite}
                      onDelete={() => onDeleteFood(food.id)}
                      showDelete
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="favorites" className="mt-4">
          <ScrollArea className="h-[calc(100vh-220px)] min-h-[300px]">
            <div className="pb-[env(safe-area-inset-bottom,1rem)]">
              {favorites.length > 0 ? (
                <div className="space-y-2">
                  {favorites.map((food) => (
                    <FoodListItem
                      key={food.id}
                      food={food}
                      onAdd={(qty) => onAddFood(food, qty)}
                      onToggleFavorite={() => onToggleFavorite(food.id)}
                      isFavorite={true}
                    />
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No favorites yet. Star foods to add them here!
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        {extraTabContents}
      </Tabs>
    </div>
  )
}
