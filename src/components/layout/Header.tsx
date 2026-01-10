import type { ReactNode } from "react"
import { ChevronLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface HeaderProps {
  title: string
  showBack?: boolean
  rightAction?: ReactNode
  className?: string
}

export function Header({
  title,
  showBack = false,
  rightAction,
  className,
}: HeaderProps) {
  const navigate = useNavigate()

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-top",
        className
      )}
    >
      {showBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="-ml-2"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}
      <h1 className="flex-1 text-lg font-semibold">{title}</h1>
      {rightAction}
    </header>
  )
}
