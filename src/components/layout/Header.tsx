import type { ReactNode } from "react"
import { ChevronLeft } from "lucide-react"
import { useRouter } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { BrandIcon } from "./Logo"
import { cn } from "@/lib/utils"

interface HeaderProps {
  title: string
  showBack?: boolean
  onBack?: () => void
  rightAction?: ReactNode
  className?: string
  /** Content rendered below the title bar but still inside the sticky header */
  bottomContent?: ReactNode
}

export function Header({
  title,
  showBack = false,
  onBack,
  rightAction,
  className,
  bottomContent,
}: HeaderProps) {
  const router = useRouter()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      router.history.back()
    }
  }

  const isDashboard = title.toLowerCase() === "inertia" || title.toLowerCase() === "dashboard"
  const displayTitle = isDashboard ? "NERTIA" : title

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-top transition-all duration-300",
        className
      )}
    >
      <div className="flex h-14 items-center px-4 gap-0">
        {/* Back Button Slot: Zero width when hidden, fixed width when shown */}
        <div 
          className={cn(
            "flex items-center transition-all duration-300 ease-in-out overflow-hidden",
            showBack ? "w-8 opacity-100" : "w-0 opacity-0"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-8 w-8 -ml-2 shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Branding Slot: This will slide smoothly when the back button appears */}
        <div className="flex items-center min-w-0 overflow-hidden">
          <BrandIcon />
          <h1 className={cn(
            "text-xl truncate pr-1 transition-all duration-300",
            isDashboard ? "ml-[1px]" : "ml-2"
          )}>
            {displayTitle}
          </h1>
        </div>
        
        <div className="flex-1" />
        
        <div className="shrink-0">
          {rightAction}
        </div>
      </div>
      {bottomContent}
    </header>
  )
}
