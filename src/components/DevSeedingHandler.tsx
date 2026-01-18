import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { seedTestData } from "@/services/devSeeding"
import { PageLoader } from "@/components/ui/PageLoader"

export function DevSeedingHandler() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [isSeeding, setIsSeeding] = useState(false)

  useEffect(() => {
    let isMounted = true

    if (import.meta.env.DEV && searchParams.get("seed") === "true") {
      const runSeed = async () => {
        setIsSeeding(true)
        try {
          await seedTestData()
          
          if (!isMounted) return

          // Remove the seed param and reload to ensure all stores are fresh
          searchParams.delete("seed")
          setSearchParams(searchParams)
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
  }, [searchParams, setSearchParams])

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
