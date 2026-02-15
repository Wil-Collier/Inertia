import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from "react"
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
import type { FoodItem, MealTemplateEntry } from "@/lib/types"
import { db } from "@/services/db"
import { getProductByBarcode } from "@/services/nutritionApi"
import { toast } from "sonner"
import { Route } from "@/routes/nutrition/template-editor"

const BarcodeScanner = lazy(() =>
  import("@/components/BarcodeScanner").then((m) => ({ default: m.BarcodeScanner }))
)

export function TemplateEditorPage() {
  type TemplateEditorEntry = MealTemplateEntry & { localId: string }

  const navigate = useNavigate()
  const { templateId } = useSearch({ from: Route.fullPath })
  const { data: templates = [] } = useMealTemplates()
  
  const existingTemplate = useMemo(
    () => templates.find((t) => t.id === templateId),
    [templates, templateId]
  )

  const [name, setName] = useState("")
  const [entries, setEntries] = useState<TemplateEditorEntry[]>([])
  const [initializedTemplateId, setInitializedTemplateId] = useState<string | null>(null)
  
  // Sheet state for adding foods
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [activeTab, setActiveTab] = useState("search")
  const [searchQuery, setSearchQuery] = useState("")
  const [showScanner, setShowScanner] = useState(false)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
  const [barcodeResults, setBarcodeResults] = useState<FoodItem[]>([])

  // Load existing template data
  useEffect(() => {
    if (!templateId) {
      if (initializedTemplateId !== null) {
        setName("")
        setEntries([])
        setInitializedTemplateId(null)
      }
      return
    }

    if (!existingTemplate) return

    if (initializedTemplateId !== templateId) {
      setName(existingTemplate.name)
      setEntries(existingTemplate.entries.map((entry) => ({ ...entry, localId: crypto.randomUUID() })))
      setInitializedTemplateId(templateId)
    }
  }, [templateId, existingTemplate, initializedTemplateId])

  // Food Search Data
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500)
  const { data: combinedSearch, isFetching: isSearching } = useCombinedFoodSearch(debouncedSearchQuery)
  const searchResults = combinedSearch?.items ?? []
  const remoteStatus = combinedSearch?.remoteStatus
  const remoteError = combinedSearch?.remoteError
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
          entries: entries.map(({ localId: _localId, ...entry }) => entry),
        })
      } else {
        await saveMutation.mutateAsync({
          name: name.trim(),
          entries: entries.map(({ localId: _localId, ...entry }) => entry),
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
        localId: crypto.randomUUID(),
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

  const handleScanBarcode = () => {
    setShowScanner(true)
  }

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    setShowScanner(false)
    setIsLookingUp(true)

    try {
      const food = await getProductByBarcode(barcode)

      if (food) {
        setBarcodeResults([food])
        setSearchQuery("")
        setActiveTab("search")
        toast.success(`Found: ${food.name}`)
      } else {
        setScannedBarcode(barcode)
        setActiveTab("myfoods")
        toast.info("Product not found. Create a custom entry.")
      }
    } catch (error) {
      console.error("Barcode lookup error:", error)
      toast.error("Failed to look up product")
    } finally {
      setIsLookingUp(false)
    }
  }, [])
  
  const [resolvedFoods, setResolvedFoods] = useState<Map<string, FoodItem>>(new Map())
  
  const foodIds = useMemo(() => {
    return Array.from(new Set(entries.map(e => e.foodId))).toSorted().join(",")
  }, [entries])

  useEffect(() => {
    const fetchFoods = async () => {
      const ids = foodIds.split(",").filter(Boolean)
      if (ids.length === 0) {
        setResolvedFoods(new Map())
        return
      }
      
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
          <Button size="sm" onClick={() => void handleSave()} disabled={!name.trim() || entries.length === 0}>
            <Save className="mr-1 h-4 w-4" />
            Save
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Template Name */}
        <div className="space-y-2">
          <label htmlFor="template-name" className="text-sm font-medium text-muted-foreground">Template Name</label>
          <div className="relative">
            <Input
              id="template-name"
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
                    key={entry.localId}
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
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle className="uppercase tracking-tight">Add to Template</SheetTitle>
          </SheetHeader>
          
          <FoodSearch
            className="mt-4 px-4 flex flex-col h-[calc(80vh-100px)]"
            activeTab={activeTab}
            onTabChange={setActiveTab}
            searchQuery={searchQuery}
            onSearchQueryChange={(q) => {
              setSearchQuery(q)
              if (q) setBarcodeResults([])
            }}
            isSearching={isSearching}
            isLookingUp={isLookingUp}
            searchResults={displayedResults}
            remoteStatus={remoteStatus}
            remoteError={remoteError}
            onScanBarcode={handleScanBarcode}
            onAddFood={(food, qty) => void handleAddFoodToTemplate(food, qty)}
            onToggleFavorite={(id) => {
              void (async () => {
                const food = [...favorites, ...customFoods, ...displayedResults].find((f) => f.id === id)
                if (food) {
                  await toggleFavoriteMutation.mutateAsync({ id, isFavorite: !food.isFavorite, food })
                }
              })()
            }}
            onDeleteFood={(id) => void deleteFoodMutation.mutateAsync(id)}
            favorites={favorites}
            customFoods={customFoods}
            scannedBarcode={scannedBarcode}
            onClearBarcode={() => setScannedBarcode(null)}
            onSaveCustomFood={(food) => {
              void addFoodMutation.mutateAsync({ ...food, isCustom: true })
            }}
            onSaveAndAddCustomFood={(food) => {
              void (async () => {
                const newFood = await addFoodMutation.mutateAsync({ ...food, isCustom: true })
                await handleAddFoodToTemplate(newFood, 1)
              })()
            }}
          />
        </SheetContent>
      </Sheet>

      {showScanner && (
        <Suspense fallback={null}>
          <BarcodeScanner
            isOpen={showScanner}
            onClose={() => setShowScanner(false)}
            onScan={(barcode) => {
              void handleBarcodeScan(barcode)
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
