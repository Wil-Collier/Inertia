import { useNavigate } from "@tanstack/react-router"
import { AlertTriangle, Home, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ErrorBoundary } from "./ErrorBoundary"

interface ErrorFallbackProps {
  error: Error
  reset: () => void
}

function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  const navigate = useNavigate()

  const handleGoHome = () => {
    reset()
    navigate({ to: "/" })
  }

  const handleRetry = () => {
    reset()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-destructive/10 p-3 mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            
            <p className="text-muted-foreground mb-4 text-sm">
              {error.message || "An unexpected error occurred. Please try again."}
            </p>

            {/* Error details for development */}
            {import.meta.env.DEV && (
              <details className="w-full mb-4 text-left">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Technical details
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                  {error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleGoHome}
              >
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
              <Button
                className="flex-1"
                onClick={handleRetry}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface PageErrorBoundaryProps {
  children: React.ReactNode
}

/**
 * Error boundary wrapper for page-level components.
 * Displays a user-friendly error UI with options to retry or go home.
 * 
 * Usage:
 * ```tsx
 * <PageErrorBoundary>
 *   <MyPage />
 * </PageErrorBoundary>
 * ```
 */
export function PageErrorBoundary({ children }: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => <ErrorFallback error={error} reset={reset} />}
    >
      {children}
    </ErrorBoundary>
  )
}
