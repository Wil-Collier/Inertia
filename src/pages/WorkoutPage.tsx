import { useState, useMemo, Fragment } from "react"
import { useNavigate, Link, Navigate } from "@tanstack/react-router"
import { Plus, Dumbbell, Clock, LayoutTemplate, History, ChevronRight } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useActiveSession, useActiveSessionActions } from "@/features/workout/hooks/useActiveSession"
import { useTemplates, useWorkoutDates, useWorkoutStats } from "@/features/workout/queries"
import { useExercisesByIds } from "@/features/exercises/queries"
import { cn } from "@/lib/utils"
import { format, subDays, startOfMonth, endOfMonth, parseISO } from "date-fns"
import type { MuscleGroup } from "@/lib/types"

export function WorkoutPage() {
  const navigate = useNavigate()
  const { data: activeSession } = useActiveSession()
  const { startWorkout } = useActiveSessionActions()
  
  const { data: templates = [] } = useTemplates()
  const { data: workoutDates = [] } = useWorkoutDates()

  // Resolve exercise names for templates
  const templateExerciseIds = useMemo(() => {
    return [...new Set(templates.flatMap(template => template.exercises.map(exercise => exercise.exerciseId)))]
  }, [templates])
  const { data: exercisesById = new Map() } = useExercisesByIds(templateExerciseIds)
  
  const now = useMemo(() => new Date(), [])
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const thirtyDaysAgo = subDays(now, 30)

  const { data: monthStats } = useWorkoutStats(
    format(monthStart, "yyyy-MM-dd"),
    format(monthEnd, "yyyy-MM-dd")
  )
  const monthWorkouts = useMemo(() => monthStats?.workouts ?? [], [monthStats?.workouts])

  const { data: recentStats } = useWorkoutStats(
    format(thirtyDaysAgo, "yyyy-MM-dd"),
    format(now, "yyyy-MM-dd")
  )
  const recentWorkouts = useMemo(() => recentStats?.workouts ?? [], [recentStats?.workouts])
  
  // Generate default workout name with today's date
  const getDefaultWorkoutName = () => {
    const today = new Date()
    const formattedDate = format(today, "MMMM d")
    return `${formattedDate} Workout`
  }
  
  const [newWorkoutName, setNewWorkoutName] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleStartBlankWorkout = async () => {
    const name = newWorkoutName.trim() || getDefaultWorkoutName()
    await startWorkout({ name })
    setNewWorkoutName("")
    setIsDialogOpen(false)
    navigate({ to: "/workout/active" })
  }

  const handleStartFromTemplate = async (templateId: string, templateName: string) => {
    await startWorkout({ name: templateName, templateId })
    navigate({ to: "/workout/active" })
  }

  // Calculate Stats
  const stats = useMemo(() => {
    const workoutsThisMonth = monthWorkouts.length

    // Momentum: Workouts in the last 4 weeks
    const weeks = [0, 1, 2, 3].map(weekOffset => {
      const weekStart = subDays(now, (weekOffset + 1) * 7)
      const weekEnd = subDays(now, weekOffset * 7)
      const count = recentWorkouts.filter(workout => {
        const date = new Date(workout.date)
        return date >= weekStart && date <= weekEnd
      }).length
      return { offset: weekOffset, count }
    }).reverse()

    return { workoutsThisMonth, weeks }
  }, [monthWorkouts, recentWorkouts, now])

  if (activeSession) {
    return <Navigate to="/workout/active" replace />
  }

  const recentDates = workoutDates.slice().reverse().slice(0, 3)

  return (
    <div className="flex flex-col pb-20">
      <Header
        title="Workout"
        rightAction={
          <div className="flex gap-1">
            <Link to="/workout/history">
              <Button variant="ghost" size="sm" className="font-bold gap-1.5">
                <History className="h-4 w-4" />
                History
              </Button>
            </Link>
          </div>
        }
      />

      <div className="space-y-6 p-4">
        {/* Momentum & Stats */}
        <section className="grid grid-cols-2 gap-4">
           <Card className="bg-primary/5 border-none shadow-none">
            <CardContent className="pt-4 pb-3">
              <p className="text-3xl font-black tracking-tight">{stats.workoutsThisMonth}</p>
              <p className="text-xxs font-bold text-muted-foreground uppercase tracking-wider">Workouts this month</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-none shadow-none">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-end gap-1.5 h-8 mb-1">
                {stats.weeks.map((week, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "flex-1 rounded-t-sm transition-all duration-500",
                      week.count > 0 ? "bg-primary" : "bg-primary/20"
                    )}
                    style={{ height: `${Math.min(100, (week.count / 4) * 100)}%`, minHeight: '4px' }}
                  />
                ))}
              </div>
              <p className="text-xxs font-bold text-muted-foreground uppercase tracking-wider">4-Week Momentum</p>
            </CardContent>
          </Card>
        </section>

        {/* Start New Workout */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Quick Start
            </h2>
          </div>
          <Card 
            className="cursor-pointer interactive-card border-none bg-primary text-primary-foreground shadow-lg shadow-primary/20"
            onClick={() => setIsDialogOpen(true)}
          >
            <CardContent className="flex items-center gap-4 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-black italic uppercase">Empty Workout</p>
                <p className="text-xs text-primary-foreground/70 font-medium">
                  Log a custom session from scratch
                </p>
              </div>
              <ChevronRight className="ml-auto h-5 w-5 opacity-50" />
            </CardContent>
          </Card>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start New Workout</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Workout Name</Label>
                  <Input
                    placeholder={getDefaultWorkoutName()}
                    value={newWorkoutName}
                    onChange={(e) => setNewWorkoutName(e.target.value)}
                    autoFocus
                    className="text-lg py-6"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleStartBlankWorkout()
                    }}
                  />
                </div>
                <Button onClick={handleStartBlankWorkout} size="xl" className="w-full">
                  Let's Go
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </section>

        {/* Templates */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              My Templates
            </h2>
            <Link 
              to="/workout/templates" 
              className="text-xxs font-bold text-primary uppercase bg-primary/10 px-2 py-1 rounded"
            >
              Manage
            </Link>
          </div>

          {templates.length === 0 ? (
            <Card className="border-dashed border-2 bg-transparent">
              <CardContent className="py-8 text-center space-y-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <LayoutTemplate className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-muted-foreground">No templates yet</p>
                  <p className="text-xs text-muted-foreground/60 max-w-48 mx-auto">
                    Save your favorite routines to start them faster next time.
                  </p>
                </div>
                <Link 
                  to="/workout/templates" 
                  className={buttonVariants({ variant: "outline", className: "font-bold" })}
                >
                  Create First Template
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {templates.map((template) => {
                const muscleGroups = Array.from(new Set(
                  template.exercises
                    .map(templateExercise => exercisesById.get(templateExercise.exerciseId)?.muscleGroup)
                    .filter(Boolean)
                )) as MuscleGroup[]

                return (
                  <Card
                    key={template.id}
                    className="cursor-pointer interactive-card"
                    onClick={() =>
                      handleStartFromTemplate(template.id, template.name)
                    }
                  >
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Dumbbell className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black uppercase italic text-sm truncate">{template.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xxs font-bold text-muted-foreground uppercase tracking-tighter">
                            {template.exercises.length} Exercises
                          </span>
                          {muscleGroups.length > 0 && (
                            <>
                              <span className="text-muted-foreground/30">•</span>
                              <span className="text-xxs font-bold text-primary/70 uppercase truncate">
                                {muscleGroups.slice(0, 2).join(" • ")}
                                {muscleGroups.length > 2 && " +"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {/* Recent Activity */}
        {recentDates.length > 0 && (
          <section className="space-y-3">
             <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Recent Sessions
              </h2>
            </div>
            <div className="space-y-2">
              {recentDates.map((date) => {
                const dateWorkouts = recentWorkouts.filter((workout) => workout.date === date)
                return (
                  <Fragment key={date}>
                    {dateWorkouts.map((workout) => (
                      <Card key={workout.id} className="bg-muted/20 border-none shadow-none">
                        <CardContent className="flex items-center gap-4 py-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background border">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{workout.name}</p>
                            <p className="text-xxs font-medium text-muted-foreground">
                              {format(parseISO(workout.date), "MMM d, yyyy")}
                              {workout.duration && ` • ${workout.duration}m`}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </Fragment>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
