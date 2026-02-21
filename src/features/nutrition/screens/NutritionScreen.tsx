import { useState, useCallback, lazy, Suspense, useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { History, Coffee, Utensils, Moon, Cookie, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { getToday } from "@/lib/dateUtils"
import type { FoodItem, MealType } from "@/lib/types"
import {
  useDailyNutrition,
  useFavoriteFoods,
  useCustomFoods,
  useMealTemplates,
  useCombinedFoodSearch,
  useNutritionProvider,
} from "@/features/nutrition/queries"
import {
  useAddMealEntry,
  useUpdateMealEntry,
  useRemoveMealEntry,
  useAddFood,
  useDeleteFood,
  useToggleFavoriteFood,
  useDeleteMealTemplate,
  useApplyMealTemplate,
  useRemoveMealEntryGroup,
} from "@/features/nutrition/mutations"
import {
  ensureFoodExistsInLocalDb,
  lookupFoodByBarcode,
} from "@/features/nutrition/services"
import { useSettings } from "@/features/settings/queries"
import { MacroSummary } from "@/features/nutrition/components/MacroSummary"
import { MealLogger } from "@/features/nutrition/components/MealLogger"
import { AddFoodSheet } from "@/features/nutrition/components/AddFoodSheet"
import { DateNavigator } from "@/features/nutrition/components/DateNavigator"

const BarcodeScanner = lazy(() =>
  import("@/features/nutrition/components/BarcodeScanner").then((m) => ({ default: m.BarcodeScanner }))
)

const mealTypes: { type: MealType; label: string; icon: LucideIcon }[] = [
  { type: "breakfast", label: "Breakfast", icon: Coffee },
  { type: "lunch", label: "Lunch", icon: Utensils },
  { type: "dinner", label: "Dinner", icon: Moon },
  { type: "snack", label: "Snacks", icon: Cookie },
]

export function NutritionScreen() {
  const [selectedDate, setSelectedDate] = useState(getToday())
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [selectedMealType, setSelectedMealType] = useState<MealType>("breakfast")
  const [searchQuery, setSearchQuery] = useState("")
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("search")
  const [barcodeResults, setBarcodeResults] = useState<FoodItem[]>([])

  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query)
    if (query.length > 0) {
      setBarcodeResults([])
    }
  }, [])

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500)
  const { data: combinedSearch, isFetching: isSearching } =
    useCombinedFoodSearch(debouncedSearchQuery)

  const searchResults = combinedSearch?.items ?? []
  const remoteStatus = combinedSearch?.remoteStatus
  const remoteError = combinedSearch?.remoteError
  const { data: nutritionProvider } = useNutritionProvider()
  const searchProvider = combinedSearch?.provider ?? nutritionProvider

  const displayedResults = barcodeResults.length > 0 ? barcodeResults : searchResults

  const addFoodMutation = useAddFood()
  const addMealEntryMutation = useAddMealEntry()
  const updateMealEntryMutation = useUpdateMealEntry()
  const removeMealEntryMutation = useRemoveMealEntry()
  const toggleFavoriteMutation = useToggleFavoriteFood()
  const deleteFoodMutation = useDeleteFood()
  const deleteMealTemplateMutation = useDeleteMealTemplate()
  const applyMealTemplateMutation = useApplyMealTemplate()
  const removeMealEntryGroupMutation = useRemoveMealEntryGroup()

  const { data: nutritionData } = useDailyNutrition(selectedDate)
  const { data: favorites = [] } = useFavoriteFoods()
  const { data: customFoods = [] } = useCustomFoods()
  const { data: mealTemplates = [] } = useMealTemplates()

  const { data: settings } = useSettings()
  const nutritionGoals = settings?.nutritionGoals ?? {
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 65,
    fiber: 30,
    sugar: 50,
  }

  const totals = nutritionData?.totals
  const entriesWithFood = useMemo(
    () => nutritionData?.entriesWithFood ?? [],
    [nutritionData?.entriesWithFood]
  )

  const getEntriesByMealType = useCallback(
    (type: MealType) => {
      return entriesWithFood.filter((entry) => entry.mealType === type)
    },
    [entriesWithFood]
  )

  const handleAddFood = useCallback(
    async (food: FoodItem, qty: number) => {
      await ensureFoodExistsInLocalDb(food, addFoodMutation.mutateAsync)

      addMealEntryMutation.mutate(
        {
          date: selectedDate,
          foodId: food.id,
          quantity: qty,
          mealType: selectedMealType,
        },
        {
          onSuccess: () => {
            setShowAddSheet(false)
            setSearchQuery("")
            setBarcodeResults([])
          },
        }
      )
    },
    [selectedDate, selectedMealType, addFoodMutation.mutateAsync, addMealEntryMutation]
  )

  const handleOpenAddSheet = useCallback((mealType: MealType) => {
    setSelectedMealType(mealType)
    setShowAddSheet(true)
    setActiveTab("search")
    setScannedBarcode(null)
    setBarcodeResults([])
  }, [])

  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      setShowScanner(false)
      setIsLookingUp(true)

      try {
        const food = await lookupFoodByBarcode(barcode)

        if (food) {
          await handleAddFood(food, 1)
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
    },
    [handleAddFood]
  )

  const selectedMealLabel = useMemo(
    () => mealTypes.find((meal) => meal.type === selectedMealType)?.label,
    [selectedMealType]
  )

  const handleToggleFavorite = useCallback(
    async (id: string) => {
      const food = [...favorites, ...customFoods, ...displayedResults].find((item) => item.id === id)
      if (food) {
        await toggleFavoriteMutation.mutateAsync({ id, isFavorite: !food.isFavorite, food })
      }
    },
    [favorites, customFoods, displayedResults, toggleFavoriteMutation]
  )

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))]">
      <Header
        title="Nutrition"
        rightAction={
          <Link to="/nutrition/history">
            <Button variant="ghost" size="sm" className="font-bold gap-1.5">
              <History className="h-4 w-4" />
              History
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 p-4 pb-20">
        <DateNavigator
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          calendarOpen={calendarOpen}
          onCalendarOpenChange={setCalendarOpen}
        />

        <MacroSummary totals={totals} goals={nutritionGoals} />

        <MealLogger
          mealTypes={mealTypes}
          getEntriesByMealType={getEntriesByMealType}
          openAddSheet={handleOpenAddSheet}
          onUpdateQuantity={async (id, quantity) => {
            await updateMealEntryMutation.mutateAsync({
              date: selectedDate,
              entryId: id,
              updates: { quantity },
            })
          }}
          onRemoveEntry={async (id) => {
            await removeMealEntryMutation.mutateAsync({ date: selectedDate, entryId: id })
          }}
          onRemoveGroup={async (id) => {
            await removeMealEntryGroupMutation.mutateAsync({
              date: selectedDate,
              templateInstanceId: id,
            })
          }}
        />
      </div>

      <AddFoodSheet
        isOpen={showAddSheet}
        onOpenChange={setShowAddSheet}
        selectedMealLabel={selectedMealLabel}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={handleSearchQueryChange}
        isSearching={isSearching}
        isLookingUp={isLookingUp}
        searchResults={displayedResults}
        remoteStatus={remoteStatus}
        remoteError={remoteError}
        searchProvider={searchProvider}
        onScanBarcode={() => setShowScanner(true)}
        onAddFood={handleAddFood}
        onToggleFavorite={handleToggleFavorite}
        onDeleteFood={(id: string) => deleteFoodMutation.mutateAsync(id)}
        favorites={favorites}
        customFoods={customFoods}
        mealTemplates={mealTemplates}
        scannedBarcode={scannedBarcode}
        onClearBarcode={() => setScannedBarcode(null)}
        onSaveCustomFood={(food) => {
          void (async () => {
            await addFoodMutation.mutateAsync({ ...food, isCustom: true })
            setScannedBarcode(null)
          })()
        }}
        onSaveAndAddCustomFood={(food) => {
          void (async () => {
            const newFood = await addFoodMutation.mutateAsync({ ...food, isCustom: true })
            await handleAddFood(newFood, 1)
            setScannedBarcode(null)
          })()
        }}
        onDeleteTemplate={(id: string) => {
          deleteMealTemplateMutation.mutate(id)
        }}
        onApplyTemplate={async (templateId: string) => {
          applyMealTemplateMutation.mutate(
            { templateId, date: selectedDate, mealType: selectedMealType },
            {
              onSuccess: () => setShowAddSheet(false),
            }
          )
        }}
      />

      {showScanner && (
        <Suspense fallback={null}>
          <BarcodeScanner
            isOpen={showScanner}
            onClose={() => setShowScanner(false)}
            onScan={(code) => void handleBarcodeScan(code)}
          />
        </Suspense>
      )}
    </div>
  )
}
