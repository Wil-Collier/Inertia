import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"

interface DebouncedTextInputProps extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> {
    value: string
    onChange: (value: string) => void
    debounceMs?: number
}

/**
 * A text input that debounces onChange calls to avoid excessive updates.
 * Useful for fields that trigger database writes on change.
 */
export function DebouncedTextInput({ value, onChange, debounceMs = 300, ...props }: DebouncedTextInputProps) {
    const [localValue, setLocalValue] = useState(value ?? "")
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Sync with external value when not focused (e.g., after save)
    useEffect(() => {
        const isFocused = document.activeElement === inputRef.current
        if (!isFocused) {
            setLocalValue(value ?? "")
        }
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setLocalValue(val)

        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
            onChange(val)
        }, debounceMs)
    }

    // Flush pending changes on blur
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }
        // Only call onChange if value differs from prop
        if (localValue !== value) {
            onChange(localValue)
        }
        props.onBlur?.(e)
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
            onBlur={handleBlur}
        />
    )
}
