import { useState, useMemo } from "react"
import { format, isSameDay, startOfMonth, endOfMonth } from "date-fns"
import { Dumbbell, Clock, ChevronDown, ChevronUp } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDuration } from "@/lib/utils"
import { useWorkoutStore } from "@/stores/workout"
import { useExerciseStore } from "@/stores/exerciseStore"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import type { Workout } from "@/lib/types"

export function WorkoutCalendar() {
  const { workouts } = useWorkoutStore()
  const { getExercise } = useExerciseStore()
  const weightUnit = useWeightUnit()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null)

  // Get all dates that have workouts
  const workoutDates = useMemo(() => {
    return new Set(workouts.map((w) => w.date))
  }, [workouts])

  // Get workouts for selected date
  const selectedDateWorkouts = useMemo(() => {
    const dateStr = format(selectedDate, "yyyy-MM-dd")
    return workouts
      .filter((w) => w.date === dateStr)
      .sort((a, b) => {
        if (a.completedAt && b.completedAt) {
          return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
        }
        return 0
      })
  }, [workouts, selectedDate])

  // Calculate stats for a workout
  const getWorkoutStats = (workout: Workout) => {
    const totalVolume = workout.exercises.reduce((total, ex) => {
      return total + ex.sets.reduce((setTotal, set) => {
        return setTotal + (set.completed ? set.weight * set.reps : 0)
      }, 0)
    }, 0)

    const totalSets = workout.exercises.reduce((total, ex) => {
      return total + ex.sets.filter((s) => s.completed).length
    }, 0)

    return { totalVolume, totalSets }
  }

  // Get workout count for a specific month
  const getMonthWorkoutCount = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const startStr = format(start, "yyyy-MM-dd")
    const endStr = format(end, "yyyy-MM-dd")
    
    return workouts.filter((w) => w.date >= startStr && w.date <= endStr).length
  }, [workouts, currentMonth])

  // Custom day render to show workout indicators
  const modifiers = useMemo(() => ({
    hasWorkout: (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd")
      return workoutDates.has(dateStr)
    },
  }), [workoutDates])

  const modifiersStyles = {
    hasWorkout: {
      position: "relative" as const,
    },
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Workout Calendar" showBack />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Calendar */}
        <div className="p-4 pb-2">
          <Card>
            <CardContent className="p-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                modifiers={modifiers}
                modifiersStyles={modifiersStyles}
                className="w-full"
                classNames={{
                  day: "relative",
                }}
                components={{
                  DayButton: ({ day, modifiers: dayModifiers, ...props }) => {
                    const dateStr = format(day.date, "yyyy-MM-dd")
                    const hasWorkout = workoutDates.has(dateStr)
                    const isSelected = isSameDay(day.date, selectedDate)
                    const isToday = isSameDay(day.date, new Date())

                    return (
                      <button
                        {...props}
                        className={`
                          relative flex flex-col items-center justify-center w-full aspect-square
                          text-sm font-medium rounded-md transition-colors
                          ${isSelected 
                            ? "bg-primary text-primary-foreground" 
                            : isToday 
                              ? "bg-muted text-foreground" 
                              : "hover:bg-muted/50"
                          }
                          ${dayModifiers.outside ? "text-muted-foreground opacity-50" : ""}
                        `}
                      >
                        {day.date.getDate()}
                        {hasWorkout && !isSelected && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                        )}
                        {hasWorkout && isSelected && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-foreground" />
                        )}
                      </button>
                    )
                  },
                }}
              />
              
              {/* Month stats */}
              <div className="mt-2 pt-2 border-t text-center text-sm text-muted-foreground">
                {getMonthWorkoutCount} workout{getMonthWorkoutCount !== 1 ? "s" : ""} in {format(currentMonth, "MMMM yyyy")}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selected Date Workouts */}
        <div className="flex-1 overflow-hidden px-4 pb-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            {format(selectedDate, "EEEE, MMMM d, yyyy")}
          </h2>

          <ScrollArea className="h-full">
            {selectedDateWorkouts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Dumbbell className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No workouts on this day
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {selectedDateWorkouts.map((workout) => {
                  const { totalVolume, totalSets } = getWorkoutStats(workout)
                  const isExpanded = expandedWorkoutId === workout.id

                  return (
                    <Card key={workout.id}>
                      <CardContent className="p-0">
                        {/* Workout Header */}
                        <button
                          className="flex w-full items-center gap-3 p-3 text-left"
                          onClick={() => setExpandedWorkoutId(isExpanded ? null : workout.id)}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Dumbbell className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{workout.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {workout.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {workout.duration} min
                                </span>
                              )}
                              <span>•</span>
                              <span>{totalSets} sets</span>
                              <span>•</span>
                              <span>{weightUnit.format(totalVolume, { decimals: 0 })}</span>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>

                        {/* Expanded Exercise Details */}
                        {isExpanded && (
                          <div className="border-t px-3 pb-3 pt-2 space-y-2">
                            {workout.exercises.map((we) => {
                              const exercise = getExercise(we.exerciseId)
                              const completedSets = we.sets.filter((s) => s.completed)

                              return (
                                <div key={we.id} className="text-sm">
                                  <p className="font-medium">
                                    {exercise?.name ?? "Unknown Exercise"}
                                  </p>
                                  <div className="mt-0.5 text-muted-foreground">
                                    {completedSets.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {completedSets.map((set) => (
                                          <span
                                            key={set.id}
                                            className="rounded bg-muted px-1.5 py-0.5 text-xs"
                                          >
                                            {exercise?.isTimeBased ? (
                                              formatDuration(set.reps)
                                            ) : exercise?.isWeighted ? (
                                              `${weightUnit.format(set.weight, { showUnit: false })}×${set.reps}`
                                            ) : (
                                              `${set.reps} reps`
                                            )}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-xs italic">No completed sets</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
