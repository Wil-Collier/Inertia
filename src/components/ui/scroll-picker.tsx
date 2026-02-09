import * as React from "react"
import { cn } from "@/lib/utils"

interface ScrollPickerProps {
  value: number
  options: number[]
  onChange: (value: number) => void
  unit?: string
  disabled?: boolean
  className?: string
  height?: number
  itemHeight?: number
}

export function ScrollPicker({
  value,
  options,
  onChange,
  unit = "",
  disabled = false,
  className,
  height = 120,
  itemHeight = 36,
}: ScrollPickerProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>(null)

  // Find index of current value
  const selectedIndex = options.indexOf(value)
  const safeIndex = selectedIndex === -1 ? 0 : selectedIndex

  // Initial scroll to value
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = safeIndex * itemHeight
    }
  }, [itemHeight, safeIndex])

  const handleScroll = () => {
    if (disabled || !scrollRef.current) return

    // Simple debounce/snap logic
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(() => {
      if (!scrollRef.current) return

      const scrollTop = scrollRef.current.scrollTop
      const newIndex = Math.round(scrollTop / itemHeight)
      const snappedScrollTop = newIndex * itemHeight

      if (scrollTop !== snappedScrollTop) {
        scrollRef.current.scrollTo({
          top: snappedScrollTop,
          behavior: "smooth"
        })
      }

      if (options[newIndex] !== undefined && options[newIndex] !== value) {
        onChange(options[newIndex])
      }
    }, 50)
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-background/50 rounded-md border border-input",
        "before:absolute before:top-0 before:left-0 before:right-0 before:h-12 before:bg-gradient-to-b before:from-background before:to-transparent before:z-10 before:pointer-events-none",
        "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-12 after:bg-gradient-to-t after:from-background after:to-transparent after:z-10 after:pointer-events-none",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
      style={{ height: `${height}px` }}
    >
      {/* Selection Highlight */}
      <div
        className="absolute left-2 right-2 border-y border-primary/30 bg-primary/5 pointer-events-none z-0"
        style={{
          height: `${itemHeight}px`,
          top: `${(height - itemHeight) / 2}px`
        }}
      />

      {/* Scrollable List */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden relative z-0 touch-pan-y"
        style={{
          paddingTop: `${(height - itemHeight) / 2}px`,
          paddingBottom: `${(height - itemHeight) / 2}px`
        }}
      >
        {options.map((opt) => (
          <div
            key={opt}
            className={cn(
              "flex items-center justify-center text-lg transition-all snap-center",
              value === opt ? "text-primary font-bold scale-125" : "text-muted-foreground/40"
            )}
            style={{ height: `${itemHeight}px` }}
          >
            <span className="tabular-nums">{opt}</span>
            {unit && <span className="ml-1 text-[10px] opacity-70 uppercase font-mono">{unit}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
