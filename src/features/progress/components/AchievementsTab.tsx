import { useMemo, useState } from "react"
import { Award } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AchievementBadge } from "@/features/achievements/components/AchievementBadge"
import { StreakDisplay } from "@/features/achievements/components/StreakDisplay"
import { AchievementCard } from "@/features/achievements/components/AchievementCard"
import { useAchievements } from "@/features/achievements/queries"
import {
  achievements,
  categoryLabels,
  type AchievementCategory,
  type AchievementDefinition,
} from "@/data/achievements"

const achievementCategories: AchievementCategory[] = [
  "consistency",
  "volume",
  "strength",
  "nutrition",
  "variety",
]

interface AchievementsTabProps {
  totalWorkouts: number
  totalVolume: number
  prCount: number
}

export function AchievementsTab({
  totalWorkouts,
  totalVolume,
  prCount,
}: AchievementsTabProps) {
  const { data: achievementsData } = useAchievements()
  const unlockedAchievements = achievementsData?.unlockedAchievements ?? []
  const [showLocked, setShowLocked] = useState(true)

  const getUnlockedAchievement = (id: string) => unlockedAchievements.find(a => a.id === id)

  // Group achievements by category
  const groupedAchievements = useMemo(() => {
    const groups: Record<AchievementCategory, AchievementDefinition[]> = {
      consistency: [],
      volume: [],
      strength: [],
      nutrition: [],
      variety: [],
    }

    for (const achievement of achievements) {
      groups[achievement.category].push(achievement)
    }

    return groups
  }, [])

  // Get progress for each achievement
  const getProgress = (achievementId: string): number | undefined => {
    switch (achievementId) {
      case "first-workout":
      case "ten-workouts":
      case "fifty-workouts":
      case "century-club":
        return totalWorkouts
      case "10k-club":
      case "100k-crusher":
      case "500k-beast":
      case "million-pounder":
        return totalVolume
      case "first-pr":
      case "pr-collector":
      case "pr-master":
        return prCount
      default:
        return undefined
    }
  }

  const unlockedCount = unlockedAchievements.length
  const totalCount = achievements.length

  return (
    <div className="space-y-4">
      {/* Streaks */}
      <StreakDisplay />

      {/* Progress Summary */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <AchievementBadge icon={Award} className="h-12 w-12 [&_svg]:h-6 [&_svg]:w-6" />
            <div>
              <p className="text-2xl font-bold">
                {unlockedCount} / {totalCount}
              </p>
              <p className="text-sm text-muted-foreground">
                Achievements Unlocked
              </p>
            </div>
            <div className="ml-auto">
              <Button
                size="sm"
                variant={showLocked ? "default" : "outline"}
                onClick={() => setShowLocked(!showLocked)}
              >
                {showLocked ? "Hide Locked" : "Show All"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Achievements by Category */}
      {achievementCategories.map((category) => {
        const categoryAchievements = groupedAchievements[category]
        const visibleAchievements = showLocked
          ? categoryAchievements
          : categoryAchievements.filter((a) => getUnlockedAchievement(a.id))

        if (visibleAchievements.length === 0) return null

        return (
          <div key={category} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {categoryLabels[category]}
            </h3>
            <div className="space-y-2">
              {visibleAchievements.map((achievement) => (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  unlocked={getUnlockedAchievement(achievement.id)}
                  progress={getProgress(achievement.id)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
