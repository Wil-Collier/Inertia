import { useState, useEffect } from "react"
import { Plus, X, ScanBarcode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FoodItem } from "@/lib/types"

interface CustomFoodFormProps {
  onSave: (food: Omit<FoodItem, "id" | "isCustom">) => void
  onSaveAndAdd: (food: Omit<FoodItem, "id" | "isCustom">) => void
  initialBarcode?: string | null
  onClearBarcode?: () => void
}

export function CustomFoodForm({
  onSave,
  onSaveAndAdd,
  initialBarcode,
  onClearBarcode,
}: CustomFoodFormProps) {
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
    <div className="space-y-4 rounded-lg border p-4 animate-in fade-in slide-in-from-top-2 duration-300">
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
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Food name"
          className="font-bold"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Calories</label>
          <Input
            type="number"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="0"
            className="font-black italic"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Serving Size</label>
          <Input
            value={servingSize}
            onChange={(e) => setServingSize(e.target.value)}
            placeholder="1 serving"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Protein (g)</label>
          <Input
            type="number"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Carbs (g)</label>
          <Input
            type="number"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Fat (g)</label>
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
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Fiber (g)</label>
          <Input
            type="number"
            value={fiber}
            onChange={(e) => setFiber(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Sugar (g)</label>
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
