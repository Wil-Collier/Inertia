import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface DurationInputProps {
  /** Value in seconds */
  value: number
  /** Called with value in seconds */
  onChange: (seconds: number) => void
  /** Whether the input is disabled */
  disabled?: boolean
  /** Additional class names */
  className?: string
}

/**
 * A duration input that displays and accepts MM:SS format.
 * Internally stores and returns values in seconds.
 */
export function DurationInput({
  value,
  onChange,
  disabled = false,
  className,
}: DurationInputProps) {
  // Convert seconds to display format
  const formatValue = useCallback((totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }, [])

  const [displayValue, setDisplayValue] = useState(() => formatValue(value))

  // Sync display value when external value changes
  useEffect(() => {
    setDisplayValue(formatValue(value))
  }, [value, formatValue])

  const parseInput = useCallback((input: string): number | null => {
    // Remove any non-digit characters except colon
    const cleaned = input.replace(/[^\d:]/g, "")
    
    // Handle different input formats
    if (cleaned.includes(":")) {
      const [minStr, secStr] = cleaned.split(":")
      const minutes = parseInt(minStr || "0", 10)
      const seconds = parseInt(secStr || "0", 10)
      
      if (isNaN(minutes) || isNaN(seconds)) return null
      if (seconds > 59) return null
      
      return minutes * 60 + seconds
    } else {
      // Treat as total seconds if no colon
      const totalSeconds = parseInt(cleaned, 10)
      if (isNaN(totalSeconds)) return null
      return totalSeconds
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setDisplayValue(inputValue)
  }

  const handleBlur = () => {
    const parsed = parseInput(displayValue)
    if (parsed !== null && parsed >= 0) {
      onChange(parsed)
      setDisplayValue(formatValue(parsed))
    } else {
      // Reset to previous valid value
      setDisplayValue(formatValue(value))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur()
    }
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      placeholder="0:00"
      className={cn("h-9 font-mono", className)}
    />
  )
}
