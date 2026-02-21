import { Search, X, ScanBarcode, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FoodListItem } from "./FoodListItem"
import { CustomFoodForm } from "./CustomFoodForm"
import type { FoodItem } from "@/lib/types"
import type { NutritionProviderName } from "@/features/nutrition/services"

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
  remoteStatus?: "idle" | "ok" | "error"
  remoteError?: string
  searchProvider?: NutritionProviderName
  className?: string
  extraTabTriggers?: React.ReactNode
  extraTabContents?: React.ReactNode
}

const PROVIDER_METADATA: Record<NutritionProviderName, { label: string; href: string }> = {
  fatsecret: {
    label: "FatSecret",
    href: "https://platform.fatsecret.com/api/",
  },
  openfoodfacts: {
    label: "Open Food Facts",
    href: "https://world.openfoodfacts.org/",
  },
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
  remoteStatus,
  remoteError,
  searchProvider,
  className,
  extraTabTriggers,
  extraTabContents,
}: FoodSearchProps) {
  const providerMeta = searchProvider ? PROVIDER_METADATA[searchProvider] : null

  return (
    <div className={cn("flex flex-col", className)}>
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full flex-1 flex flex-col min-h-0">
        <TabsList className="w-full shrink-0">
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

        <TabsContent value="search" className="mt-4 flex-1 flex flex-col min-h-0">
          <div className="flex gap-2 shrink-0">
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
                  aria-label="Clear food search"
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
              aria-label="Scan barcode"
              title="Scan barcode"
            >
              {isLookingUp ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanBarcode className="h-4 w-4" />
              )}
            </Button>
          </div>

          {remoteStatus === "error" && searchQuery.trim().length >= 2 && searchResults.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground shrink-0">
              Remote search unavailable. Showing local results{remoteError ? ": " + remoteError : ""}
            </p>
          )}

          <ScrollArea className="mt-4 flex-1" hideScrollBar>
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
                  Search foods from local data
                  {providerMeta ? (
                    <>
                      {" and "}
                      <a
                        href={providerMeta.href}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                      >
                        {providerMeta.label}
                      </a>
                      .
                    </>
                  ) : (
                    " and your configured nutrition provider."
                  )}
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="myfoods" className="mt-4 flex-1 flex flex-col min-h-0">
          <div className="shrink-0">
            <CustomFoodForm
              onSave={onSaveCustomFood}
              onSaveAndAdd={onSaveAndAddCustomFood}
              initialBarcode={scannedBarcode}
              onClearBarcode={onClearBarcode}
            />
          </div>

          {customFoods.length > 0 && (
            <ScrollArea className="flex-1 mt-3">
              <div className="space-y-2 pb-[env(safe-area-inset-bottom,1rem)]">
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
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="favorites" className="mt-4 flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1">
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
