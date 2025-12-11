'use client';

import React, { useState, useEffect } from 'react';
import { BranchProvider } from '@/lib/branch-context';

/**
 * BranchPageWrapper component
 * A wrapper component that ensures the page has access to branch context
 * Used to prevent hydration errors with branch context
 */
export function BranchPageWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During server-side rendering or before hydration, render placeholder
  if (!mounted) {
    return <div className="min-h-screen bg-gray-50"></div>;
  }

  // Wrap children with BranchProvider to ensure context is available
  return <BranchProvider>{children}</BranchProvider>;
}
