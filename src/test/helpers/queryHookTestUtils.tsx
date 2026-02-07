import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export function createQueryWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}
