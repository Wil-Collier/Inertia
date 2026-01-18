import { Outlet } from "react-router-dom"
import { BottomNav } from "./BottomNav"
import { Toaster } from "@/components/ui/sonner"
import { useTheme } from "@/hooks/useTheme"

export function Layout() {
  // Initialize theme
  useTheme()

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <BottomNav />
      <Toaster position="top-center" richColors />
    </div>
  )
}
