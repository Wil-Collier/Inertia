import type { ReactNode } from "react"
import { ChevronLeft } from "lucide-react"
import { useRouter } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
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

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-top",
        className
      )}
    >
      <div className="flex h-11 items-center gap-2 px-4">
        {showBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="-ml-2"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="flex-1 text-lg font-semibold">{title}</h1>
        {rightAction}
      </div>
      {bottomContent}
    </header>
  )
}
