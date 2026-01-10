import type { ReactNode } from "react"
import { Outlet } from "react-router-dom"
import { BottomNav } from "./BottomNav"
import { Toaster } from "@/components/ui/sonner"
import { useTheme } from "@/hooks/useTheme"

interface LayoutProps {
  children?: ReactNode
}

export function Layout({ children }: LayoutProps) {
  // Initialize theme
  useTheme()

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="flex-1 pb-20">
        {children ?? <Outlet />}
      </main>
      <BottomNav />
      <Toaster position="top-center" richColors />
    </div>
  )
}
