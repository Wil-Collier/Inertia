import { useState, useMemo, useEffect } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { Plus, Save, Pencil } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { FoodSearch } from "@/components/nutrition/FoodSearch"
import { MealEntryItem } from "@/components/nutrition/MealEntryItem"
import {
  useMealTemplates,
  useCombinedFoodSearch,
  useFavoriteFoods,
  useCustomFoods,
} from "@/features/nutrition/queries"
import {
  useSaveMealTemplate,
  useUpdateMealTemplate,
  useAddFood,
  useToggleFavoriteFood,
  useDeleteFood,
} from "@/features/nutrition/mutations"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import type { FoodItem, MealEntry } from "@/lib/types"
import { toast } from "sonner"
import { Route } from "@/routes/nutrition/template-editor"

export function TemplateEditorPage() {
  const navigate = useNavigate()
  const { templateId } = useSearch({ from: Route.fullPath })
  const { data: templates = [] } = useMealTemplates()
  
  const existingTemplate = useMemo(
    () => templates.find((t) => t.id === templateId),
    [templates, templateId]
  )

  const [name, setName] = useState("")
  const [entries, setEntries] = useState<Omit<MealEntry, "id">[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Sheet state for adding foods
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [activeTab, setActiveTab] = useState("search")
  const [searchQuery, setSearchQuery] = useState("")
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
  const [barcodeResults, setBarcodeResults] = useState<FoodItem[]>([])

  // Load existing template data
  useEffect(() => {
    if (templateId && existingTemplate && !isInitialized) {
      setName(existingTemplate.name)
      setEntries(existingTemplate.entries)
      setIsInitialized(true)
    }
  }, [templateId, existingTemplate, isInitialized])

  // Food Search Data
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500)
  const { data: searchResults = [], isFetching: isSearching } = useCombinedFoodSearch(debouncedSearchQuery)
  const { data: favorites = [] } = useFavoriteFoods()
  const { data: customFoods = [] } = useCustomFoods()
  
  const displayedResults = barcodeResults.length > 0 ? barcodeResults : searchResults

  // Mutations
  const saveMutation = useSaveMealTemplate()
  const updateMutation = useUpdateMealTemplate()
  const addFoodMutation = useAddFood()
  const toggleFavoriteMutation = useToggleFavoriteFood()
  const deleteFoodMutation = useDeleteFood()

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a template name")
      return
    }
    if (entries.length === 0) {
      toast.error("Please add at least one food")
      return
    }

    try {
      if (templateId) {
        await updateMutation.mutateAsync({
          id: templateId,
          name: name.trim(),
          entries,
        })
      } else {
        await saveMutation.mutateAsync({
          name: name.trim(),
          entries,
        })
      }
      await navigate({ to: "/nutrition" })
    } catch {
      // Mutation handles error toast
    }
  }

  const handleAddFoodToTemplate = async (food: FoodItem, quantity: number) => {
    // Ensure the food exists in our local DB if it's from an external search
    if (!food.isCustom) {
      try {
        const { db } = await import("@/services/db")
        const exists = await db.foods.get(food.id)
        if (!exists) {
          await addFoodMutation.mutateAsync({ ...food, isCustom: false })
        }
      } catch (error) {
        console.error("Failed to ensure food exists in DB:", error)
      }
    }

    setEntries((prev) => [
      ...prev,
      {
        foodId: food.id,
        quantity,
        mealType: "snack", // Default, will be overridden when applied
        templateId: templateId, // Keep reference if editing
      },
    ])
    setShowAddSheet(false)
    setSearchQuery("")
    setBarcodeResults([])
    toast.success(`Added ${food.name}`)
  }

  const handleRemoveEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateQuantity = (index: number, quantity: number) => {
    setEntries((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], quantity }
      return next
    })
  }

  const handleScanBarcode = async () => {
    // Mock scanner for now or reuse scanner component logic if available
    // For now simple alert or reuse the logic from NutritionPage
    // Since BarcodeScanner is lazy loaded there, we might need to duplicate the lazy load logic here
    // For MVP/Proto, let's assume manual entry or mock
    toast.info("Barcode scanner not connected in this view yet")
  }

  // Calculate totals for preview
  // Note: We need the full food objects for this. We can get them from the cache or existing lists
  // But strictly speaking, `entries` only has `foodId`.
  // We need to resolve `foodId` to `FoodItem` to show the list properly.
  // We can use `useFoods` hook if it exists, or derive from existing queries.
  // Let's assume we can map them if they are in favorites/custom/search results.
  // Actually, `useDailyNutrition` does this resolution on the backend (DB).
  // Here we might need `useFoodsByIds` or similar.
  // For now, let's just use `favorites` + `customFoods` + `searchResults` to try to find them,
  // or fetch all foods? `useFoods()` (all) might be heavy but reliable for local DB.
  
  // Let's assume we have a hook or just fetch them.
  // In `NutritionPage` we rely on `useDailyNutrition` to return `entriesWithFood`.
  // Here we are editing. We need the food details.
  // `useMealTemplates` returns `entries` with `foodId`.
  // Wait, `MealEntry` has `foodId`.
  // We need to fetch the food details for these IDs.
  
  // Let's implement a quick fetch for these foods.
  // We can use `useQueries` or just `db.foods.bulkGet(ids)`.
  // Since we are in a component, let's use a specialized hook or effect.
  
  const [resolvedFoods, setResolvedFoods] = useState<Map<string, FoodItem>>(new Map())
  
  const foodIds = useMemo(() => {
    return Array.from(new Set(entries.map(e => e.foodId))).sort().join(",")
  }, [entries])

  useEffect(() => {
    const fetchFoods = async () => {
      const ids = foodIds.split(",").filter(Boolean)
      if (ids.length === 0) {
        setResolvedFoods(new Map())
        return
      }
      
      const { db } = await import("@/services/db")
      const foods = await db.foods.where("id").anyOf(ids).toArray()
      const map = new Map(foods.map(f => [f.id, f]))
      setResolvedFoods(map)
    }
    void fetchFoods()
  }, [foodIds])

  const totalCalories = useMemo(() => {
    return entries.reduce((sum, entry) => {
      const food = resolvedFoods.get(entry.foodId)
      return sum + (food ? food.calories * entry.quantity : 0)
    }, 0)
  }, [entries, resolvedFoods])

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header
        title={templateId ? "Edit Template" : "New Template"}
        showBack
        rightAction={
          <Button size="sm" onClick={handleSave} disabled={!name.trim() || entries.length === 0}>
            <Save className="mr-1 h-4 w-4" />
            Save
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Template Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Template Name</label>
          <div className="relative">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Breakfast Burrito"
              className="text-lg font-medium"
            />
            <Pencil className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Ingredients List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">Ingredients ({entries.length})</label>
            {entries.length > 0 && (
              <span className="text-sm font-bold text-primary">{Math.round(totalCalories)} Cal Total</span>
            )}
          </div>
          
          {entries.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>No ingredients yet.</p>
                <p className="text-sm">Add foods to build your template.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, index) => {
                const food = resolvedFoods.get(entry.foodId)
                if (!food) return null
                
                return (
                  <MealEntryItem
                    key={`${entry.foodId}-${index}`}
                    entry={{ id: index.toString(), quantity: entry.quantity }}
                    food={food}
                    onRemove={() => handleRemoveEntry(index)}
                    onUpdateQuantity={(qty) => handleUpdateQuantity(index, qty)}
                    className="bg-muted/30"
                  />
                )
              })}
            </div>
          )}
          
          <Button className="w-full py-6" variant="outline" onClick={() => setShowAddSheet(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Ingredient
          </Button>
        </div>
      </div>

      {/* Add Food Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="bottom" className="h-[85vh]">
          <SheetHeader>
            <SheetTitle>Add to Template</SheetTitle>
          </SheetHeader>
          
          <FoodSearch
            className="mt-4 px-4"
            activeTab={activeTab}
            onTabChange={setActiveTab}
            searchQuery={searchQuery}
            onSearchQueryChange={(q) => {
              setSearchQuery(q)
              if (q) setBarcodeResults([])
            }}
            isSearching={isSearching}
            isLookingUp={false}
            searchResults={displayedResults}
            onScanBarcode={handleScanBarcode}
            onAddFood={handleAddFoodToTemplate}
            onToggleFavorite={async (id) => {
               const food = [...favorites, ...customFoods, ...displayedResults].find(f => f.id === id)
               if (food) {
                 await toggleFavoriteMutation.mutateAsync({ id, isFavorite: !food.isFavorite, food })
               }
            }}
            onDeleteFood={(id) => deleteFoodMutation.mutateAsync(id)}
            favorites={favorites}
            customFoods={customFoods}
            scannedBarcode={scannedBarcode}
            onClearBarcode={() => setScannedBarcode(null)}
            onSaveCustomFood={async (food) => {
              await addFoodMutation.mutateAsync({ ...food, isCustom: true })
            }}
            onSaveAndAddCustomFood={async (food) => {
              const newFood = await addFoodMutation.mutateAsync({ ...food, isCustom: true })
              await handleAddFoodToTemplate(newFood, 1)
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
