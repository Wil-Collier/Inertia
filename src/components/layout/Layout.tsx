import { BottomNav } from "./BottomNav"
import { Toaster } from "@/components/ui/sonner"
import { useTheme } from "@/hooks/useTheme"
import type { ReactNode } from "react"

interface LayoutProps {
  children?: ReactNode
}

export function Layout({ children }: LayoutProps) {
  // Initialize theme
  useTheme()

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="flex-1 pb-20">
        {children}
      </main>
      <BottomNav />
      <Toaster position="top-center" richColors />
    </div>
  )
}
