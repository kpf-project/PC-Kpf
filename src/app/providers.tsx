"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ModalProvider } from "@/contexts/ModalContext";
import { FloatingChatButton } from "@/components/FloatingChatButton";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Create QueryClient outside component to ensure singleton
// This prevents recreating the client on every render and losing cache
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient(): QueryClient {
  // Server: always create a new client (SSR)
  if (typeof window === 'undefined') {
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // Cache data for 5 minutes
          gcTime: 10 * 60 * 1000,   // Keep cached data for 10 minutes
          retry: 1,                  // Retry failed requests once
          refetchOnWindowFocus: false,
        },
      },
    });
  }

  // Browser: create client once and reuse (singleton pattern)
  // ✅ Fixed: Prevents QueryClient recreation on re-renders
  if (!browserQueryClient) {
    browserQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
          gcTime: 10 * 60 * 1000,
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    });
  }

  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // useMemo ensures getQueryClient() is only called once
  const queryClient = useMemo(() => getQueryClient(), []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ModalProvider>
          <AuthProvider>
            {children}
            <FloatingChatButton />
          </AuthProvider>
        </ModalProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}