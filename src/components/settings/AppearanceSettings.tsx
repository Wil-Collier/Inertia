import { Sun, Moon, Monitor } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { ThemeMode } from "@/lib/types"

interface AppearanceSettingsProps {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

export function AppearanceSettings({ theme, setTheme }: AppearanceSettingsProps) {
  const themeOptions: { value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Appearance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={theme === value ? "default" : "outline"}
              className="flex-1"
              onClick={() => setTheme(value)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
