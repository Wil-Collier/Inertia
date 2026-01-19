import { useEffect } from "react"
import { useSettings } from "@/features/settings/queries"
import { useUpdateSettings } from "@/features/settings/mutations"
import type { ThemeMode } from "@/lib/types"

export function useTheme() {
  const { data: settings } = useSettings()
  const theme = settings?.theme ?? ("system" as ThemeMode)
  const updateSettingsMutation = useUpdateSettings()

  const setTheme = (newTheme: ThemeMode) => {
    updateSettingsMutation.mutate({ theme: newTheme })
  }

  useEffect(() => {
    const root = window.document.documentElement

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add("dark")
      } else {
        root.classList.remove("dark")
      }
    }

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      applyTheme(mediaQuery.matches)

      const handler = (e: MediaQueryListEvent) => {
        applyTheme(e.matches)
      }

      mediaQuery.addEventListener("change", handler)
      return () => mediaQuery.removeEventListener("change", handler)
    } else {
      applyTheme(theme === "dark")
    }
  }, [theme])

  return { theme, setTheme }
}
