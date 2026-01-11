import { useState, useEffect, useCallback } from "react"
import { format, addDays, subDays, parseISO } from "date-fns"
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Search,
  Star,
  Trash2,
  X,
  Check,
  ScanBarcode,
  Loader2,
} from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
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
import { useNutritionStore, getTodayDate } from "@/stores/nutritionStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { searchFoods, getProductByBarcode } from "@/services/openFoodFacts"
import { BarcodeScanner } from "@/components/BarcodeScanner"
import { toast } from "sonner"
import type { FoodItem, MealType } from "@/lib/types"

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

  const {
    foods,
    getDailyTotals,
    getEntriesByMealType,
    getFood,
    addFood,
    addMealEntry,
    removeMealEntry,
    toggleFavorite,
    getFavorites,
    getCustomFoods,
    deleteFood,
    searchFoods: searchLocalFoods,
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
      const { foods: remote } = await searchFoods(query, 1, 10)
      
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
      <Header title="Nutrition" />

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
                        <div
                          key={entry.id}
                          className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">{food.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {entry.quantity > 1 ? `${entry.quantity}x ` : ""}
                              {food.servingSize} •{" "}
                              {Math.round(food.calories * entry.quantity)} kcal
                            </p>
                          </div>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => removeMealEntry(selectedDate, entry.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
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
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
      />
    </div>
  )
}

function MacroBar({
  label,
  value,
  goal,
  color,
}: {
  label: string
  value: number
  goal: number
  color: string
}) {
  const percentage = goal > 0 ? Math.min((value / goal) * 100, 100) : 0

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
      </div>
      <Progress value={percentage} className={`h-2 [&>div]:${color}`} />
      <p className="text-xs font-medium">
        {Math.round(value)}g / {goal}g
      </p>
    </div>
  )
}

function FoodListItem({
  food,
  onAdd,
  onToggleFavorite,
  isFavorite,
  onDelete,
  showDelete,
}: {
  food: FoodItem
  onAdd: (quantity: number) => void
  onToggleFavorite: () => void
  isFavorite?: boolean
  onDelete?: () => void
  showDelete?: boolean
}) {
  const [quantity, setQuantity] = useState(1)
  const [isExpanded, setIsExpanded] = useState(false)

  const adjustedCalories = Math.round(food.calories * quantity)
  const adjustedProtein = Math.round(food.protein * quantity * 10) / 10
  const adjustedCarbs = Math.round(food.carbs * quantity * 10) / 10
  const adjustedFat = Math.round(food.fat * quantity * 10) / 10
  const adjustedFiber = Math.round((food.fiber ?? 0) * quantity * 10) / 10
  const adjustedSugar = Math.round((food.sugar ?? 0) * quantity * 10) / 10

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
    if (!isExpanded) {
      setQuantity(1)
    }
  }

  const incrementQuantity = (e: React.MouseEvent) => {
    e.stopPropagation()
    setQuantity((q) => Math.round((q + 0.5) * 10) / 10)
  }

  const decrementQuantity = (e: React.MouseEvent) => {
    e.stopPropagation()
    setQuantity((q) => Math.max(0.5, Math.round((q - 0.5) * 10) / 10))
  }

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    onAdd(quantity)
    setIsExpanded(false)
    setQuantity(1)
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
        onClick={handleToggleExpand}
      >
        <div className="flex-1">
          <p className="font-medium">{food.name}</p>
          {food.brand && (
            <p className="text-xs text-muted-foreground">{food.brand}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {food.calories} kcal • P: {food.protein}g • C: {food.carbs}g • F:{" "}
            {food.fat}g
          </p>
          <p className="text-xs text-muted-foreground">{food.servingSize}</p>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
        >
          <Star
            className={`h-4 w-4 ${isFavorite ? "fill-yellow-500 text-yellow-500" : ""}`}
          />
        </Button>
        {showDelete && onDelete && (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="border-t bg-muted/30 p-3 space-y-3">
          {/* Quantity Selector */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Servings</span>
            <div className="flex items-center gap-2">
              <Button
                size="icon-sm"
                variant="outline"
                onClick={decrementQuantity}
                disabled={quantity <= 0.5}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={incrementQuantity}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Adjusted Macros */}
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{adjustedCalories} kcal</span>
            {" • "}P: {adjustedProtein}g • C: {adjustedCarbs}g • F: {adjustedFat}g
            <br />
            Fiber: {adjustedFiber}g • Sugar: {adjustedSugar}g
          </div>

          {/* Add Button */}
          <Button className="w-full" onClick={handleAdd}>
            <Check className="mr-2 h-4 w-4" />
            Add {quantity > 1 ? `${quantity} servings` : ""}
          </Button>
        </div>
      )}
    </div>
  )
}

function CustomFoodForm({
  onSave,
  onSaveAndAdd,
  initialBarcode,
  onClearBarcode,
}: {
  onSave: (food: Omit<FoodItem, "id" | "isCustom">) => void
  onSaveAndAdd: (food: Omit<FoodItem, "id" | "isCustom">) => void
  initialBarcode?: string | null
  onClearBarcode?: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [name, setName] = useState("")
  const [calories, setCalories] = useState("")
  const [protein, setProtein] = useState("")
  const [carbs, setCarbs] = useState("")
  const [fat, setFat] = useState("")
  const [fiber, setFiber] = useState("")
  const [sugar, setSugar] = useState("")
  const [servingSize, setServingSize] = useState("1 serving")
  const [barcode, setBarcode] = useState("")

  // Auto-expand when barcode is scanned
  useEffect(() => {
    if (initialBarcode) {
      setIsExpanded(true)
      setBarcode(initialBarcode)
    }
  }, [initialBarcode])

  const getFoodData = (): Omit<FoodItem, "id" | "isCustom"> => ({
    name: name.trim(),
    calories: parseFloat(calories) || 0,
    protein: parseFloat(protein) || 0,
    carbs: parseFloat(carbs) || 0,
    fat: parseFloat(fat) || 0,
    fiber: parseFloat(fiber) || 0,
    sugar: parseFloat(sugar) || 0,
    servingSize,
    barcode: barcode.trim() || undefined,
  })

  const resetForm = () => {
    setName("")
    setCalories("")
    setProtein("")
    setCarbs("")
    setFat("")
    setFiber("")
    setSugar("")
    setServingSize("1 serving")
    setBarcode("")
    setIsExpanded(false)
    onClearBarcode?.()
  }

  const handleSave = () => {
    if (!name.trim()) return
    onSave(getFoodData())
    resetForm()
  }

  const handleSaveAndAdd = () => {
    if (!name.trim()) return
    onSaveAndAdd(getFoodData())
    resetForm()
  }

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setIsExpanded(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Create New Food
      </Button>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium">
          {initialBarcode ? "Create Food (Scanned)" : "Create New Food"}
        </p>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => {
            setIsExpanded(false)
            onClearBarcode?.()
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {barcode && (
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          <ScanBarcode className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Barcode:</span>
          <span className="font-mono">{barcode}</span>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Food name"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Calories</label>
          <Input
            type="number"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Serving Size</label>
          <Input
            value={servingSize}
            onChange={(e) => setServingSize(e.target.value)}
            placeholder="1 serving"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Protein (g)</label>
          <Input
            type="number"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Carbs (g)</label>
          <Input
            type="number"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Fat (g)</label>
          <Input
            type="number"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Fiber (g)</label>
          <Input
            type="number"
            value={fiber}
            onChange={(e) => setFiber(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Sugar (g)</label>
          <Input
            type="number"
            value={sugar}
            onChange={(e) => setSugar(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={!name.trim()}
          onClick={handleSave}
        >
          Save Only
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={!name.trim()}
          onClick={handleSaveAndAdd}
        >
          Save & Add
        </Button>
      </div>
    </div>
  )
}
