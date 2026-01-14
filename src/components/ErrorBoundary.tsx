import { Component, type ReactNode, type ErrorInfo } from "react"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary component that catches JavaScript errors in its child component tree.
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary fallback={<ErrorMessage />}>
 *   <ComponentThatMightThrow />
 * </ErrorBoundary>
 * 
 * // Or with a render prop for access to error and reset:
 * <ErrorBoundary fallback={(error, reset) => <ErrorUI error={error} onRetry={reset} />}>
 *   <ComponentThatMightThrow />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console (could be sent to error reporting service)
    console.error("ErrorBoundary caught an error:", error)
    console.error("Component stack:", errorInfo.componentStack)
    
    // Call optional onError callback
    this.props.onError?.(error, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Render fallback UI
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error, this.reset)
      }
      if (this.props.fallback) {
        return this.props.fallback
      }
      // Default minimal fallback
      return null
    }

    return this.props.children
  }
}
