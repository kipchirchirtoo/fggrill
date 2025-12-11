'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
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
      <AuthProvider>
        <BranchProvider>
          {children}
          <Toaster position="top-right" richColors />
        </BranchProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
