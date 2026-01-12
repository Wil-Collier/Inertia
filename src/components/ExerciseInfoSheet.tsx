import { useState } from "react"
import { Info, Play, CheckCircle2, Lightbulb, ExternalLink } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getExerciseInstructions } from "@/data/exerciseInstructions"
import { muscleGroupLabels } from "@/data/defaultExercises"
import type { Exercise } from "@/lib/types"

interface ExerciseInfoSheetProps {
  exercise: Exercise | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExerciseInfoSheet({ exercise, open, onOpenChange }: ExerciseInfoSheetProps) {
  const [showVideo, setShowVideo] = useState(false)

  if (!exercise) return null

  const instructions = getExerciseInstructions(exercise.id)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] max-h-[85vh] rounded-t-xl">
        <SheetHeader className="pb-0">
          <SheetTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            {exercise.name}
          </SheetTitle>
          <SheetDescription>
            {muscleGroupLabels[exercise.muscleGroup]}
            {exercise.isTimeBased && " • Time-based"}
            {!exercise.isWeighted && !exercise.isTimeBased && " • Bodyweight"}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 pb-4">
          <div className="space-y-6">
            {/* YouTube Video */}
            {instructions?.youtubeId && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <Play className="h-4 w-4 text-red-500" />
                  Video Demo
                </h3>
                {showVideo ? (
                  <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
                    <iframe
                      src={`https://www.youtube.com/embed/${instructions.youtubeId}?rel=0`}
                      title={`${exercise.name} demonstration`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setShowVideo(true)}
                    className="group relative aspect-video w-full overflow-hidden rounded-lg bg-muted"
                  >
                    <img
                      src={`https://img.youtube.com/vi/${instructions.youtubeId}/hqdefault.jpg`}
                      alt={`${exercise.name} video thumbnail`}
                      className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform group-hover:scale-110">
                        <Play className="h-8 w-8 fill-current" />
                      </div>
                    </div>
                    <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                      Tap to play
                    </span>
                  </button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => window.open(`https://www.youtube.com/watch?v=${instructions.youtubeId}`, "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in YouTube
                </Button>
              </div>
            )}

            {/* Instructions */}
            {instructions?.instructions && instructions.instructions.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  How to Perform
                </h3>
                <ol className="space-y-2">
                  {instructions.instructions.map((instruction, index) => (
                    <li key={index} className="flex gap-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {index + 1}
                      </span>
                      <span className="text-muted-foreground">{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Tips */}
            {instructions?.tips && instructions.tips.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Pro Tips
                </h3>
                <ul className="space-y-2">
                  {instructions.tips.map((tip, index) => (
                    <li key={index} className="flex gap-3 text-sm">
                      <span className="text-yellow-500">•</span>
                      <span className="text-muted-foreground">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* No instructions available */}
            {!instructions && (
              <div className="py-8 text-center">
                <Info className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No instructions available for this exercise yet.
                </p>
                {exercise.isCustom && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Custom exercises don't have built-in instructions.
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// Trigger button component for easy integration
export function ExerciseInfoButton({
  exercise,
  className,
}: {
  exercise: Exercise
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const instructions = getExerciseInstructions(exercise.id)

  // Only show button if there are instructions available
  if (!instructions) return null

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className={className}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        title="Exercise info"
      >
        <Info className="h-4 w-4" />
      </Button>
      <ExerciseInfoSheet exercise={exercise} open={open} onOpenChange={setOpen} />
    </>
  )
}
