import { useState, useEffect, useCallback, lazy, Suspense } from "react"
import { format, addDays, subDays, parseISO } from "date-fns"
import { Link } from "react-router-dom"
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Trash2,
  X,
  Check,
  ScanBarcode,
  Loader2,
  BookmarkPlus,
  Bookmark,
  History,
} from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MacroBar, MealEntryItem, FoodListItem, CustomFoodForm } from "@/components/nutrition"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useNutritionStore, getTodayDate } from "@/stores/nutritionStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { searchFoods, getProductByBarcode } from "@/services/openFoodFacts"
import { toast } from "sonner"
import type { FoodItem, MealType } from "@/lib/types"

// Lazy load BarcodeScanner (includes html5-qrcode library)
const BarcodeScanner = lazy(() =>
  import("@/components/BarcodeScanner").then((m) => ({ default: m.BarcodeScanner }))
)

const mealTypes: { type: MealType; label: string }[] = [
  { type: "breakfast", label: "Breakfast" },
  { type: "lunch", label: "Lunch" },
  { type: "dinner", label: "Dinner" },
  { type: "snack", label: "Snacks" },
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

  const {
    foods,
    getDailyTotals,
    getEntriesByMealType,
    getFood,
    addFood,
    addMealEntry,
    updateMealEntry,
    removeMealEntry,
    toggleFavorite,
    getFavorites,
    getCustomFoods,
    deleteFood,
    searchFoods: searchLocalFoods,
    mealTemplates,
    saveMealTemplate,
    deleteMealTemplate,
    applyMealTemplate,
  } = useNutritionStore()

  const { settings } = useSettingsStore()
  const { nutritionGoals } = settings

  const totals = getDailyTotals(selectedDate)

  const handlePrevDay = () => {
    setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))
  }

  const handleNextDay = () => {
    setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))
  }

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      // Search local first
      const local = searchLocalFoods(query)
      
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
  }, [searchLocalFoods])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery, handleSearch])

  const handleAddFood = (food: FoodItem, qty: number) => {
    let foodId = food.id
    
    // If it's from OpenFoodFacts and not in our database, add it
    if (!food.isCustom && !foods.find((f) => f.id === food.id)) {
      const newFood = addFood({ ...food })
      foodId = newFood.id
    }
    
    addMealEntry(selectedDate, foodId, qty, selectedMealType)
    setShowAddSheet(false)
    setSearchQuery("")
    setSearchResults([])
  }

  const openAddSheet = (mealType: MealType) => {
    setSelectedMealType(mealType)
    setShowAddSheet(true)
    setActiveTab("search")
    setScannedBarcode(null)
  }

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

  const favorites = getFavorites()

  const isToday = selectedDate === getTodayDate()
  const displayDate = isToday
    ? "Today"
    : format(parseISO(selectedDate), "EEE, MMM d")

  return (
    <div className="flex flex-col">
      <Header
        title="Nutrition"
        rightAction={
          <Link to="/nutrition/history">
            <Button variant="ghost" size="icon">
              <History className="h-5 w-5" />
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
                <span className="font-medium">{displayDate}</span>
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
        <Card>
          <CardContent className="py-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{Math.round(totals.calories)}</p>
                <p className="text-sm text-muted-foreground">
                  of {nutritionGoals.calories} kcal
                </p>
              </div>
              <div className="h-20 w-20">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-muted"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeDasharray={`${Math.min(
                      (totals.calories / nutritionGoals.calories) * 100,
                      100
                    )} 100`}
                    strokeLinecap="round"
                    className="text-primary"
                  />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <MacroBar
                label="Protein"
                value={totals.protein}
                goal={nutritionGoals.protein}
                color="bg-blue-500"
              />
              <MacroBar
                label="Carbs"
                value={totals.carbs}
                goal={nutritionGoals.carbs}
                color="bg-green-500"
              />
              <MacroBar
                label="Fat"
                value={totals.fat}
                goal={nutritionGoals.fat}
                color="bg-yellow-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <MacroBar
                label="Fiber"
                value={totals.fiber}
                goal={nutritionGoals.fiber}
                color="bg-orange-500"
              />
              <MacroBar
                label="Sugar"
                value={totals.sugar}
                goal={nutritionGoals.sugar}
                color="bg-pink-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Meals */}
        {mealTypes.map(({ type, label }) => {
          const entries = getEntriesByMealType(selectedDate, type)
          const mealCalories = entries.reduce((sum, e) => {
            const food = getFood(e.foodId)
            return sum + (food ? food.calories * e.quantity : 0)
          }, 0)

          return (
            <Card key={type}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base">{label}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {Math.round(mealCalories)} kcal
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
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
                      const food = getFood(entry.foodId)
                      if (!food) return null

                      return (
                        <MealEntryItem
                          key={entry.id}
                          entry={entry}
                          food={food}
                          onUpdateQuantity={(quantity) =>
                            updateMealEntry(selectedDate, entry.id, { quantity })
                          }
                          onRemove={() => removeMealEntry(selectedDate, entry.id)}
                        />
                      )
                    })}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full text-xs text-muted-foreground"
                    onClick={() => {
                      setTemplateMealType(type)
                      setNewTemplateName(`${label} Template`)
                      setShowSaveTemplateDialog(true)
                    }}
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

      {/* Add Food Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="bottom" className="h-[85vh]">
          <SheetHeader>
            <SheetTitle>
              Add to {mealTypes.find((m) => m.type === selectedMealType)?.label}
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
                  onClick={() => setShowScanner(true)}
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
                        onAdd={(qty) => handleAddFood(food, qty)}
                        onToggleFavorite={() => toggleFavorite(food.id)}
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
              </ScrollArea>
            </TabsContent>

            <TabsContent value="myfoods" className="mt-4">
              <ScrollArea className="h-[55vh]">
                <div className="space-y-3">
                  <CustomFoodForm
                    onSave={(food) => {
                      addFood(food)
                      setScannedBarcode(null)
                    }}
                    onSaveAndAdd={(food) => {
                      const newFood = addFood(food)
                      handleAddFood(newFood, 1)
                      setScannedBarcode(null)
                    }}
                    initialBarcode={scannedBarcode}
                    onClearBarcode={() => setScannedBarcode(null)}
                  />
                  
                  {getCustomFoods().length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-sm font-medium text-muted-foreground">Saved Foods</p>
                      {getCustomFoods().map((food) => (
                        <FoodListItem
                          key={food.id}
                          food={food}
                          onAdd={(qty) => handleAddFood(food, qty)}
                          onToggleFavorite={() => toggleFavorite(food.id)}
                          isFavorite={food.isFavorite}
                          onDelete={() => deleteFood(food.id)}
                          showDelete
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
                        onAdd={(qty) => handleAddFood(food, qty)}
                        onToggleFavorite={() => toggleFavorite(food.id)}
                        isFavorite={true}
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
                      const templateCalories = template.entries.reduce((sum, e) => {
                        const food = getFood(e.foodId)
                        return sum + (food ? food.calories * e.quantity : 0)
                      }, 0)
                      const templateProtein = template.entries.reduce((sum, e) => {
                        const food = getFood(e.foodId)
                        return sum + (food ? food.protein * e.quantity : 0)
                      }, 0)

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
                              onClick={() => deleteMealTemplate(template.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {template.entries.length} items • {Math.round(templateCalories)} kcal • {Math.round(templateProtein)}g protein
                          </p>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {template.entries.slice(0, 3).map((entry, idx) => {
                              const food = getFood(entry.foodId)
                              return food ? (
                                <p key={idx}>
                                  {entry.quantity > 1 ? `${entry.quantity}x ` : ""}{food.name}
                                </p>
                              ) : null
                            })}
                            {template.entries.length > 3 && (
                              <p className="italic">+{template.entries.length - 3} more</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              applyMealTemplate(template.id, selectedDate, selectedMealType)
                              setShowAddSheet(false)
                              toast.success(`Applied "${template.name}"`)
                            }}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Apply to {mealTypes.find((m) => m.type === selectedMealType)?.label}
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
                onClick={() => {
                  const entries = getEntriesByMealType(selectedDate, templateMealType)
                  if (entries.length > 0) {
                    saveMealTemplate(
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
