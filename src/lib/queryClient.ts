import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Local Dexie data doesn't go stale (no server to sync with)
      staleTime: Infinity,
      // Keep in-memory cache indefinitely (Dexie is persistent anyway)
      gcTime: Infinity,
      // Don't refetch on window focus for local data
      refetchOnWindowFocus: false,
      // Retry failed queries (useful for IndexedDB issues)
      retry: 1,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
})
