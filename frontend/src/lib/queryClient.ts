import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './apiClient'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry auth/permission failures — they will never succeed.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404)) {
          return false
        }
        return failureCount < 2
      },
    },
    mutations: { retry: false },
  },
})
