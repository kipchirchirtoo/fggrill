'use client';

import React, { useEffect, useState } from 'react';
import { useBranch } from '@/lib/branch-context';

/**
 * BranchInitializer component
 * Ensures that branch context is properly initialized before rendering children
 * This helps prevent "useBranch must be used within a BranchProvider" errors during hydration
 */
export function BranchInitializer({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  
  // Try to access branch context
  let branchContextAvailable = false;
  try {
    // This will throw if not within a BranchProvider
    const { activeBranch } = useBranch();
    branchContextAvailable = true;
  } catch (e) {
    branchContextAvailable = false;
  }

  useEffect(() => {
    // Mark as initialized once mounted on client side
    setInitialized(true);
  }, []);

  // Safety check - if we're on client and branch context is unavailable, show error
  if (typeof window !== 'undefined' && initialized && !branchContextAvailable) {
    return (
      <div className="p-4 text-red-500 border border-red-300 rounded-md bg-red-50">
        <p className="font-bold">Branch Context Error</p>
        <p>Branch context is not available. Make sure this component is wrapped with BranchProvider.</p>
      </div>
    );
  }

  // Only render children once we've confirmed branch context is available
  // Or during server-side rendering
  return <>{initialized ? children : null}</>;
}
