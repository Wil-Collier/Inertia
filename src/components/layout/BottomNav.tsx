import { NavLink, useLocation } from "react-router-dom"
import {
  Home,
  Dumbbell,
  Utensils,
  TrendingUp,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkoutStore } from "@/stores/workout"

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/workout", icon: Dumbbell, label: "Workout" },
  { to: "/nutrition", icon: Utensils, label: "Nutrition" },
  { to: "/progress", icon: TrendingUp, label: "Progress" },
  { to: "/settings", icon: Settings, label: "Settings" },
]

export function BottomNav() {
  const location = useLocation()
  const hasActiveSession = useWorkoutStore((s) => !!s.activeSession)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-bottom">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          // Redirect to active workout when there's an ongoing session
          const to = item.to === "/workout" && hasActiveSession 
            ? "/workout/active" 
            : item.to
          
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to)

          return (
            <NavLink
              key={item.to}
              to={to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
