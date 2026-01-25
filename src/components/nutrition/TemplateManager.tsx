import { useNavigate } from "@tanstack/react-router"
import { Plus, Trash2, Pencil } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useMealTemplates, useFoods } from "@/features/nutrition/queries"
import { useDeleteMealTemplate } from "@/features/nutrition/mutations"
import { useState, useMemo } from "react"
import { calculateNutritionTotals } from "@/lib/nutritionUtils"

interface TemplateManagerProps {
  onApply?: (templateId: string) => void
}

export function TemplateManager({}: TemplateManagerProps) {
  const navigate = useNavigate()
  const { data: templates = [] } = useMealTemplates()
  const { data: allFoods = [] } = useFoods()
  const deleteMutation = useDeleteMealTemplate()
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)

  const foodsById = useMemo(() => new Map(allFoods.map((f) => [f.id, f])), [allFoods])

  const handleDelete = async () => {
    if (templateToDelete) {
      await deleteMutation.mutateAsync(templateToDelete)
      setTemplateToDelete(null)
    }
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="grid gap-4">
        <Button 
          className="w-full h-12 text-base" 
          onClick={() => navigate({ to: "/nutrition/template-editor" })}
        >
          <Plus className="mr-2 h-5 w-5" />
          Create New Template
        </Button>

        {templates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
            <p>No templates yet.</p>
            <p className="text-sm">Create one to quickly log common meals.</p>
          </div>
        ) : (
          templates.map((template) => {
            const totals = calculateNutritionTotals(template.entries, foodsById)
            const totalMacros = totals.protein + totals.carbs + totals.fat
            const p = totalMacros > 0 ? (totals.protein / totalMacros) * 100 : 0
            const c = totalMacros > 0 ? (totals.carbs / totalMacros) * 100 : 0
            const f = totalMacros > 0 ? (totals.fat / totalMacros) * 100 : 0

            return (
              <Card key={template.id} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-medium">
                    {template.name}
                  </CardTitle>
                  <div className="flex gap-1">
                     <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => navigate({ 
                        to: "/nutrition/template-editor", 
                        search: { templateId: template.id } 
                      })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setTemplateToDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 flex justify-between text-sm text-muted-foreground">
                    <span>{template.entries.length} ingredients</span>
                    <span className="font-medium text-foreground">{Math.round(totals.calories)} Cal</span>
                  </div>
                  
                  {/* Segmented Macro Bar */}
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    {p > 0 && <div className="h-full bg-macro-protein" style={{ width: `${p}%` }} />}
                    {c > 0 && <div className="h-full bg-macro-carbs" style={{ width: `${c}%` }} />}
                    {f > 0 && <div className="h-full bg-macro-fat" style={{ width: `${f}%` }} />}
                  </div>

                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-macro-protein" />
                      {Math.round(totals.protein)}g
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-macro-carbs" />
                      {Math.round(totals.carbs)}g
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-macro-fat" />
                      {Math.round(totals.fat)}g
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
