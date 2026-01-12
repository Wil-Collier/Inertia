// Achievement definitions for the training app

export type AchievementCategory = "consistency" | "volume" | "strength" | "nutrition" | "variety"

export interface AchievementDefinition {
  id: string
  name: string
  description: string
  icon: string // Lucide icon name
  category: AchievementCategory
  threshold: number
  unit?: string
}

// All achievement definitions
export const achievements: AchievementDefinition[] = [
  // Consistency achievements
  {
    id: "first-workout",
    name: "First Steps",
    description: "Complete your first workout",
    icon: "Dumbbell",
    category: "consistency",
    threshold: 1,
    unit: "workout",
  },
  {
    id: "week-warrior",
    name: "Week Warrior",
    description: "Maintain a 7-day workout streak",
    icon: "Flame",
    category: "consistency",
    threshold: 7,
    unit: "days",
  },
  {
    id: "month-master",
    name: "Month Master",
    description: "Maintain a 30-day workout streak",
    icon: "Crown",
    category: "consistency",
    threshold: 30,
    unit: "days",
  },
  {
    id: "ten-workouts",
    name: "Getting Started",
    description: "Complete 10 total workouts",
    icon: "Rocket",
    category: "consistency",
    threshold: 10,
    unit: "workouts",
  },
  {
    id: "fifty-workouts",
    name: "Dedicated",
    description: "Complete 50 total workouts",
    icon: "Medal",
    category: "consistency",
    threshold: 50,
    unit: "workouts",
  },
  {
    id: "century-club",
    name: "Century Club",
    description: "Complete 100 total workouts",
    icon: "Trophy",
    category: "consistency",
    threshold: 100,
    unit: "workouts",
  },

  // Volume achievements
  {
    id: "10k-club",
    name: "10K Club",
    description: "Lift 10,000 lbs total volume",
    icon: "Weight",
    category: "volume",
    threshold: 10000,
    unit: "lbs",
  },
  {
    id: "100k-crusher",
    name: "100K Crusher",
    description: "Lift 100,000 lbs total volume",
    icon: "Zap",
    category: "volume",
    threshold: 100000,
    unit: "lbs",
  },
  {
    id: "500k-beast",
    name: "500K Beast",
    description: "Lift 500,000 lbs total volume",
    icon: "Flame",
    category: "volume",
    threshold: 500000,
    unit: "lbs",
  },
  {
    id: "million-pounder",
    name: "Million Pounder",
    description: "Lift 1,000,000 lbs total volume",
    icon: "Star",
    category: "volume",
    threshold: 1000000,
    unit: "lbs",
  },

  // Strength achievements (PRs)
  {
    id: "first-pr",
    name: "Personal Best",
    description: "Set your first personal record",
    icon: "Award",
    category: "strength",
    threshold: 1,
    unit: "PR",
  },
  {
    id: "pr-collector",
    name: "PR Collector",
    description: "Set 10 personal records",
    icon: "Target",
    category: "strength",
    threshold: 10,
    unit: "PRs",
  },
  {
    id: "pr-master",
    name: "PR Master",
    description: "Set 25 personal records",
    icon: "Trophy",
    category: "strength",
    threshold: 25,
    unit: "PRs",
  },

  // Nutrition achievements
  {
    id: "macro-tracker",
    name: "Macro Tracker",
    description: "Log food for 7 days",
    icon: "Utensils",
    category: "nutrition",
    threshold: 7,
    unit: "days",
  },
  {
    id: "nutrition-streak",
    name: "Nutrition Streak",
    description: "Log food for 30 consecutive days",
    icon: "Flame",
    category: "nutrition",
    threshold: 30,
    unit: "days",
  },

  // Variety achievements
  {
    id: "full-body",
    name: "Full Body",
    description: "Train all 6 muscle groups in a week",
    icon: "Users",
    category: "variety",
    threshold: 6,
    unit: "muscle groups",
  },
  {
    id: "template-creator",
    name: "Template Creator",
    description: "Create 3 custom workout templates",
    icon: "LayoutTemplate",
    category: "variety",
    threshold: 3,
    unit: "templates",
  },
]

// Category labels and colors
export const categoryLabels: Record<AchievementCategory, string> = {
  consistency: "Consistency",
  volume: "Volume",
  strength: "Strength",
  nutrition: "Nutrition",
  variety: "Variety",
}

export const categoryColors: Record<AchievementCategory, string> = {
  consistency: "text-blue-500",
  volume: "text-orange-500",
  strength: "text-yellow-500",
  nutrition: "text-green-500",
  variety: "text-purple-500",
}

export const categoryBgColors: Record<AchievementCategory, string> = {
  consistency: "bg-blue-500/10",
  volume: "bg-orange-500/10",
  strength: "bg-yellow-500/10",
  nutrition: "bg-green-500/10",
  variety: "bg-purple-500/10",
}

// Helper to get achievement by ID
export function getAchievement(id: string): AchievementDefinition | undefined {
  return achievements.find((a) => a.id === id)
}
