import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"

interface DebouncedInputProps extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> {
  value: number
  onChange: (value: number) => void
  parseValue?: (rawValue: string) => number
}

export function DebouncedInput({ value, onChange, parseValue, ...props }: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value !== undefined && value !== null ? value.toString() : "")
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync with store when value changes externally (not by typing)
  useEffect(() => {
    const isFocused = document.activeElement === inputRef.current
    if (!isFocused) {
      setLocalValue(value !== undefined && value !== null ? value.toString() : "")
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalValue(val)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      const parsed = parseValue ? parseValue(val) : parseFloat(val)
      onChange(isNaN(parsed) ? 0 : parsed)
    }, 300)
  }

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <Input
      {...props}
      ref={inputRef}
      value={localValue}
      onChange={handleChange}
    />
  )
}
