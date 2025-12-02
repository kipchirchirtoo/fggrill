"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import { IOSThemeProvider, IOSThemeHydrationFix } from "./ui/ios-theme-provider"
import { Toaster } from "sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
      {/* Script to fix hydration mismatch caused by theme detection */}
      <IOSThemeHydrationFix />
      
      {/* iOS Theme Provider */}
      <IOSThemeProvider defaultTheme="system" storageKey="ios-theme">
        {/* QueryClient with hydration safety */}
        {mounted ? (
          <QueryClientProvider client={queryClient}>
            {children}
            <Toaster 
              position="top-center"
              toastOptions={{
                style: {
                  background: 'var(--ios-card-bg)',
                  color: 'var(--ios-text)',
                  border: '1px solid var(--ios-border)',
                  borderRadius: '12px',
                  boxShadow: 'var(--ios-shadow-md)',
                  fontFamily: 'var(--font-sf-pro)',
                }
              }}
            />
          </QueryClientProvider>
        ) : (
          children
        )}
      </IOSThemeProvider>
    </>
  )
}
