import { useEffect, useState } from "react"
import { useSearch, useNavigate } from "@tanstack/react-router"
import { seedTestData } from "@/services/devSeeding"
import { PageLoader } from "@/components/ui/PageLoader"

export function DevSeedingHandler() {
  const search = useSearch({ from: "__root__" }) as any
  const navigate = useNavigate()
  const [isSeeding, setIsSeeding] = useState(false)

  useEffect(() => {
    let isMounted = true

    if (import.meta.env.DEV && search.seed === "true") {
      const runSeed = async () => {
        setIsSeeding(true)
        try {
          await seedTestData()
          
          if (!isMounted) return

          // Remove the seed param and reload to ensure all stores are fresh
          await navigate({ 
            to: "/",
            search: (old: any) => {
              const { seed: _, ...rest } = old
              return rest
            } 
          })
          window.location.reload()
        } catch (error) {
          console.error("Seeding failed:", error)
          if (isMounted) {
            setIsSeeding(false)
          }
        }
      }
      runSeed()
    }

    return () => {
      isMounted = false
    }
  }, [search, navigate])

  if (isSeeding) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
        <PageLoader />
        <p className="mt-4 font-medium animate-pulse">Seeding demo data...</p>
      </div>
    )
  }

  return null
}
