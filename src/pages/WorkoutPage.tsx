import { useState } from "react"
import { useNavigate, Link, Navigate } from "react-router-dom"
import { Plus, Dumbbell, Clock, LayoutTemplate } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useWorkoutStore } from "@/stores/workoutStore"

export function WorkoutPage() {
  const navigate = useNavigate()
  const { templates, activeSession, startWorkout, getWorkoutDates, workouts } =
    useWorkoutStore()
  const [newWorkoutName, setNewWorkoutName] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleStartBlankWorkout = () => {
    const name = newWorkoutName.trim() || "Workout"
    startWorkout(name)
    setNewWorkoutName("")
    setIsDialogOpen(false)
    navigate("/workout/active")
  }

  const handleStartFromTemplate = (templateId: string, templateName: string) => {
    startWorkout(templateName, templateId)
    navigate("/workout/active")
  }

  if (activeSession) {
    return <Navigate to="/workout/active" replace />
  }

  const recentDates = getWorkoutDates().slice(0, 5)

  return (
    <div className="flex flex-col">
      <Header
        title="Workout"
        rightAction={
          <Link to="/workout/history">
            <Button variant="ghost" size="sm">History</Button>
          </Link>
        }
      />

      <div className="space-y-6 p-4">
        {/* Start New Workout */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Start Workout
          </h2>
          <Card 
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => setIsDialogOpen(true)}
          >
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium">Empty Workout</p>
                <p className="text-sm text-muted-foreground">
                  Start from scratch
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Workout</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Workout Name</Label>
                  <Input
                    placeholder="e.g., Push Day, Leg Day"
                    value={newWorkoutName}
                    onChange={(e) => setNewWorkoutName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleStartBlankWorkout()
                    }}
                  />
                </div>
                <Button onClick={handleStartBlankWorkout} className="w-full">
                  Start Workout
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </section>

        {/* Templates */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              Templates
            </h2>
            <Link to="/workout/templates">
              <Button variant="ghost" size="sm">
                <LayoutTemplate className="mr-1 h-4 w-4" />
                Manage
              </Button>
            </Link>
          </div>

          {templates.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <LayoutTemplate className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No templates yet. Create one from a completed workout!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() =>
                    handleStartFromTemplate(template.id, template.name)
                  }
                >
                  <CardContent className="flex items-center gap-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Dumbbell className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{template.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {template.exercises.length} exercises
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Recent Workouts */}
        {recentDates.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Recent Activity
            </h2>
            <div className="space-y-2">
              {recentDates.map((date) => {
                const dateWorkouts = workouts.filter((w) => w.date === date)
                return dateWorkouts.map((workout) => (
                  <Card key={workout.id}>
                    <CardContent className="flex items-center gap-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <Dumbbell className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{workout.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{workout.date}</span>
                          {workout.duration && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {workout.duration} min
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
