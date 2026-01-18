import { useState, useEffect, useCallback, lazy, Suspense, useMemo } from "react"
import { format, addDays, subDays, parseISO } from "date-fns"
import { Link } from "react-router-dom"
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  History,
  Coffee,
  Utensils,
  Moon,
  Cookie,
  type LucideIcon,
} from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { MacroSummary } from "@/components/nutrition/MacroSummary"
import { MealLogger } from "@/components/nutrition/MealLogger"
import { AddFoodSheet } from "@/components/nutrition/AddFoodSheet"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useNutritionStore, getTodayDate } from "@/stores/nutritionStore"
import { useDailyNutrition, useFoodsDB, useMealTemplatesDB } from "@/hooks/db/useNutritionDB"
import { useSettingsStore } from "@/stores/settingsStore"
import { searchFoods, getProductByBarcode } from "@/services/openFoodFacts"
import { db } from "@/services/db"
import { toast } from "sonner"
import type { FoodItem, MealType } from "@/lib/types"

// Lazy load BarcodeScanner (includes html5-qrcode library)
const BarcodeScanner = lazy(() =>
  import("@/components/BarcodeScanner").then((m) => ({ default: m.BarcodeScanner }))
)

const mealTypes: { type: MealType; label: string; icon: LucideIcon }[] = [
  { type: "breakfast", label: "Breakfast", icon: Coffee },
  { type: "lunch", label: "Lunch", icon: Utensils },
  { type: "dinner", label: "Dinner", icon: Moon },
  { type: "snack", label: "Snacks", icon: Cookie },
]

export function NutritionPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayDate())
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [selectedMealType, setSelectedMealType] = useState<MealType>("breakfast")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<FoodItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("search")
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false)
  const [templateMealType, setTemplateMealType] = useState<MealType>("breakfast")
  const [newTemplateName, setNewTemplateName] = useState("")

  const addFood = useNutritionStore((s) => s.addFood)
  const addMealEntry = useNutritionStore((s) => s.addMealEntry)
  const updateMealEntry = useNutritionStore((s) => s.updateMealEntry)
  const removeMealEntry = useNutritionStore((s) => s.removeMealEntry)
  const toggleFavorite = useNutritionStore((s) => s.toggleFavorite)
  const deleteFood = useNutritionStore((s) => s.deleteFood)
  const saveMealTemplate = useNutritionStore((s) => s.saveMealTemplate)
  const deleteMealTemplate = useNutritionStore((s) => s.deleteMealTemplate)
  const applyMealTemplate = useNutritionStore((s) => s.applyMealTemplate)

  const { totals, entriesWithFood } = useDailyNutrition(selectedDate)
  const favorites = useFoodsDB("", "favorites")
  const customFoods = useFoodsDB("", "custom")
  const mealTemplates = useMealTemplatesDB()

  const nutritionGoals = useSettingsStore((s) => s.settings.nutritionGoals)

  const getEntriesByMealType = useCallback((type: MealType) => {
    return entriesWithFood.filter(e => e.mealType === type)
  }, [entriesWithFood])

  const handlePrevDay = useCallback(() => {
    setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))
  }, [selectedDate])

  const handleNextDay = useCallback(() => {
    setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))
  }, [selectedDate])

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      // Search local first
      const q = query.toLowerCase()
      const local = await db.foods
        .filter(f => f.name.toLowerCase().includes(q) || (f.brand?.toLowerCase().includes(q) ?? false))
        .toArray()
      
      // Then search Open Food Facts
      const { foods: remote } = await searchFoods(query, 1, 20)
      
      // Combine and dedupe
      const combined = [...local, ...remote.filter(
        (r) => !local.some((l) => l.barcode === r.barcode)
      )]
      
      setSearchResults(combined)
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery, handleSearch])

  const handleAddFood = useCallback(async (food: FoodItem, qty: number) => {
    try {
      let foodId = food.id

      // If it's from OpenFoodFacts and not in our database, add it
      const exists = await db.foods.get(food.id)
      if (!food.isCustom && !exists) {
        const newFood = await addFood({ ...food })
        foodId = newFood.id
      }

      await addMealEntry(selectedDate, foodId, qty, selectedMealType)
      setShowAddSheet(false)
      setSearchQuery("")
      setSearchResults([])
    } catch {
      // Store methods already toast; swallow to avoid unhandled rejections.
    }
  }, [selectedDate, selectedMealType, addFood, addMealEntry])

  const handleOpenAddSheet = useCallback((mealType: MealType) => {
    setSelectedMealType(mealType)
    setShowAddSheet(true)
    setActiveTab("search")
    setScannedBarcode(null)
  }, [])

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    setShowScanner(false)
    setIsLookingUp(true)

    try {
      const food = await getProductByBarcode(barcode)
      
      if (food) {
        // Product found - add to search results and show it
        setSearchResults([food])
        setSearchQuery("")
        setActiveTab("search")
        toast.success(`Found: ${food.name}`)
      } else {
        // Product not found - switch to My Foods tab and open custom food form with barcode
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

  const isToday = selectedDate === getTodayDate()
  const displayDate = isToday
    ? "Today"
    : format(parseISO(selectedDate), "EEE, MMM d")

  const selectedMealLabel = useMemo(() => 
    mealTypes.find((m) => m.type === selectedMealType)?.label
  , [selectedMealType])

  return (
    <div className="flex flex-col">
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

      <div className="space-y-4 p-4">
        {/* Date Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={handlePrevDay}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col items-center gap-1">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger
                className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted transition-colors"
              >
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-lg font-black tracking-tight">{displayDate}</span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={parseISO(selectedDate)}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(format(date, "yyyy-MM-dd"))
                      setCalendarOpen(false)
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {!isToday && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground"
                onClick={() => setSelectedDate(getTodayDate())}
              >
                Go to today
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={handleNextDay}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Macro Summary */}
        <MacroSummary totals={totals} goals={nutritionGoals} />

        {/* Meals */}
        <MealLogger
          mealTypes={mealTypes}
          getEntriesByMealType={getEntriesByMealType}
          openAddSheet={handleOpenAddSheet}
          onUpdateQuantity={(id, quantity) => updateMealEntry(selectedDate, id, { quantity })}
          onRemoveEntry={(id) => removeMealEntry(selectedDate, id)}
          onSaveTemplate={(type, label) => {
            setTemplateMealType(type)
            setNewTemplateName(`${label} Template`)
            setShowSaveTemplateDialog(true)
          }}
        />
      </div>

      {/* Add Food Sheet */}
      <AddFoodSheet
        isOpen={showAddSheet}
        onOpenChange={setShowAddSheet}
        selectedMealLabel={selectedMealLabel}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearching={isSearching}
        isLookingUp={isLookingUp}
        searchResults={searchResults}
        onScanBarcode={() => setShowScanner(true)}
        onAddFood={handleAddFood}
        onToggleFavorite={toggleFavorite}
        onDeleteFood={deleteFood}
        favorites={favorites}
        customFoods={customFoods}
        mealTemplates={mealTemplates}
        scannedBarcode={scannedBarcode}
        onClearBarcode={() => setScannedBarcode(null)}
        onSaveCustomFood={async (food) => {
          try {
            await addFood(food)
            setScannedBarcode(null)
          } catch {
            // Store already toasts
          }
        }}
        onSaveAndAddCustomFood={async (food) => {
          try {
            const newFood = await addFood(food)
            await handleAddFood(newFood, 1)
            setScannedBarcode(null)
          } catch {
            // Store already toasts
          }
        }}
        onDeleteTemplate={deleteMealTemplate}
        onApplyTemplate={async (templateId) => {
          try {
            await applyMealTemplate(templateId, selectedDate, selectedMealType)
            setShowAddSheet(false)
            toast.success("Template applied")
          } catch {
            // Store already toasts
          }
        }}
      />

      {/* Barcode Scanner - Lazy loaded */}
      {showScanner && (
        <Suspense fallback={null}>
          <BarcodeScanner
            isOpen={showScanner}
            onClose={() => setShowScanner(false)}
            onScan={handleBarcodeScan}
          />
        </Suspense>
      )}

      {/* Save Template Dialog */}
      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template Name</label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Enter template name..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowSaveTemplateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={!newTemplateName.trim()}
                onClick={async () => {
                  try {
                    const entries = getEntriesByMealType(templateMealType)
                    if (entries.length > 0) {
                      await saveMealTemplate(
                        newTemplateName.trim(),
                        entries.map((e) => ({
                          foodId: e.foodId,
                          quantity: e.quantity,
                          mealType: e.mealType,
                        }))
                      )
                      toast.success(`Saved "${newTemplateName.trim()}"`)
                      setShowSaveTemplateDialog(false)
                      setNewTemplateName("")
                    }
                  } catch {
                    // Store already toasts
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
