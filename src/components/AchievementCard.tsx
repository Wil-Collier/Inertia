import { format, parseISO } from "date-fns"
import {
  Dumbbell,
  Flame,
  Crown,
  Rocket,
  Medal,
  Trophy,
  Zap,
  Star,
  Award,
  Target,
  Utensils,
  Users,
  LayoutTemplate,
  Lock,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { AchievementDefinition } from "@/data/achievements"
import { categoryColors, categoryBgColors } from "@/data/achievements"
import type { UnlockedAchievement } from "@/lib/types"

// Map icon names to components
const iconMap: Record<string, LucideIcon> = {
  Dumbbell,
  Flame,
  Crown,
  Rocket,
  Medal,
  Trophy,
  Zap,
  Star,
  Award,
  Target,
  Utensils,
  Users,
  LayoutTemplate,
  Weight: Dumbbell, // Alias
}

interface AchievementCardProps {
  achievement: AchievementDefinition
  unlocked?: UnlockedAchievement
  progress?: number // Current progress value (optional)
}

export function AchievementCard({ achievement, unlocked, progress }: AchievementCardProps) {
  const Icon = iconMap[achievement.icon] || Trophy
  const isUnlocked = !!unlocked
  const progressPercent = progress !== undefined 
    ? Math.min((progress / achievement.threshold) * 100, 100) 
    : undefined

  return (
    <Card className={cn(
      "transition-all",
      isUnlocked ? "" : "opacity-60"
    )}>
      <CardContent className="flex items-center gap-4 py-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            isUnlocked
              ? categoryBgColors[achievement.category]
              : "bg-muted"
          )}
        >
          {isUnlocked ? (
            <Icon className={cn("h-6 w-6", categoryColors[achievement.category])} />
          ) : (
            <Lock className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn(
              "font-medium",
              !isUnlocked && "text-muted-foreground"
            )}>
              {achievement.name}
            </p>
            {isUnlocked && (
              <span className={cn("text-xs", categoryColors[achievement.category])}>
                Unlocked
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {achievement.description}
          </p>
          
          {/* Progress bar for locked achievements */}
          {!isUnlocked && progressPercent !== undefined && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{progress?.toLocaleString()} / {achievement.threshold.toLocaleString()}</span>
                <span>{progressPercent.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", categoryColors[achievement.category].replace("text-", "bg-"))}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Unlock date for unlocked achievements */}
          {isUnlocked && unlocked && (
            <p className="text-xs text-muted-foreground mt-1">
              {format(parseISO(unlocked.unlockedAt), "MMM d, yyyy")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
