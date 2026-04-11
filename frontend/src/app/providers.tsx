'use client';

import { ReactNode } from 'react';
import { BranchProvider } from '@/lib/branch-context';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
    >
      {/* Toaster is outside all providers so it always mounts,
          even if a provider suspends or errors (critical for Tauri webview) */}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            // Ensure toasts are always on top of modals (z-[110] is the highest modal)
            zIndex: 9999,
          },
        }}
      />
      <BranchProvider>
        {children}
      </BranchProvider>
    </ThemeProvider>
  );
}
