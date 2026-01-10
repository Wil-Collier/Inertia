import { useState, useEffect, useCallback } from "react"
import { format, addDays, subDays, parseISO } from "date-fns"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Star,
  Trash2,
  X,
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
import { useNutritionStore, getTodayDate } from "@/stores/nutritionStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { searchFoods } from "@/services/openFoodFacts"
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
  const [quantity, setQuantity] = useState(1)

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

  const handleAddFood = (food: FoodItem) => {
    // If it's from OpenFoodFacts and not in our database, add it
    if (!food.isCustom && !foods.find((f) => f.id === food.id)) {
      addFood({ ...food })
    }
    
    addMealEntry(selectedDate, food.id, quantity, selectedMealType)
    setShowAddSheet(false)
    setSearchQuery("")
    setSearchResults([])
    setQuantity(1)
  }

  const openAddSheet = (mealType: MealType) => {
    setSelectedMealType(mealType)
    setShowAddSheet(true)
  }

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
          <span className="font-medium">{displayDate}</span>
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

          <Tabs defaultValue="search" className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="search" className="flex-1">
                Search
              </TabsTrigger>
              <TabsTrigger value="favorites" className="flex-1">
                Favorites
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex-1">
                Custom
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search foods..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
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

              <ScrollArea className="mt-4 h-[50vh]">
                {isSearching ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Searching...
                  </p>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.map((food) => (
                      <FoodListItem
                        key={food.id}
                        food={food}
                        onSelect={() => handleAddFood(food)}
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

            <TabsContent value="favorites" className="mt-4">
              <ScrollArea className="h-[55vh]">
                {favorites.length > 0 ? (
                  <div className="space-y-2">
                    {favorites.map((food) => (
                      <FoodListItem
                        key={food.id}
                        food={food}
                        onSelect={() => handleAddFood(food)}
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

            <TabsContent value="custom" className="mt-4">
              <CustomFoodForm
                onAdd={(food) => {
                  const newFood = addFood(food)
                  handleAddFood(newFood)
                }}
              />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
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
  onSelect,
  onToggleFavorite,
  isFavorite,
}: {
  food: FoodItem
  onSelect: () => void
  onToggleFavorite: () => void
  isFavorite?: boolean
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
      onClick={onSelect}
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
    </div>
  )
}

function CustomFoodForm({
  onAdd,
}: {
  onAdd: (food: Omit<FoodItem, "id" | "isCustom">) => void
}) {
  const [name, setName] = useState("")
  const [calories, setCalories] = useState("")
  const [protein, setProtein] = useState("")
  const [carbs, setCarbs] = useState("")
  const [fat, setFat] = useState("")
  const [servingSize, setServingSize] = useState("1 serving")

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim()) return

    onAdd({
      name: name.trim(),
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
      servingSize,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Food name"
          required
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

      <Button type="submit" className="w-full" disabled={!name.trim()}>
        Add Food
      </Button>
    </form>
  )
}
