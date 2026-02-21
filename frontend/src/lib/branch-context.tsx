'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';

// Branch interface
export interface Branch {
  id: number;
  name: string;
  code: string;
  location: string;
  is_main_branch: boolean;
  branch_type?: string;
  status?: string;
  number_of_rooms?: number;
  settings?: Record<string, any>;
}

// Branch context interface
interface BranchContextType {
  branches: Branch[];
  activeBranchId: number | null;
  activeBranch: Branch | null;
  setActiveBranch: (branchId: number) => void;
  isLoading: boolean;
  hasAccessToBranch: (branchId: number) => boolean;
  userBranches: Branch[];
  refreshBranches: () => Promise<void>;
  isBranchActive: (branchId: number) => boolean;
}

// Create branch context
const BranchContext = createContext<BranchContextType | undefined>(undefined);

// API URL
import { API_URL } from '@/lib/config';

// Branch Provider Component
export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userBranches, setUserBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate the active branch object - Memoized to prevent object reference changes
  const activeBranch = React.useMemo(() => (
    activeBranchId
      ? branches.find(branch => branch.id === activeBranchId) || null
      : activeBranchId === 0
        ? { id: 0, name: 'All Branches', code: 'ALL', location: 'Multiple Locations', is_main_branch: false } as Branch
        : null
  ), [activeBranchId, branches]);

  // Set initial active branch
  useEffect(() => {
    if (branches.length && user && !activeBranchId) {
      const storedBranchId = localStorage.getItem('activeBranchId');

      if (storedBranchId === '0' && canAccessAllBranches(user)) {
        setActiveBranchId(0);
      } else if (storedBranchId && isBranchAvailable(parseInt(storedBranchId))) {
        setActiveBranchId(parseInt(storedBranchId));
      } else if (canAccessAllBranches(user)) {
        // Default to "All Branches" for privileged roles (Auditor, Super Admin, etc.)
        setActiveBranchId(0);
      } else if (user.branch_id && isBranchAvailable(user.branch_id)) {
        setActiveBranchId(user.branch_id);
      } else if (userBranches.length > 0) {
        setActiveBranchId(userBranches[0].id);
      }
    }
  }, [branches, user, userBranches, activeBranchId]);

  // Helper to check if user can access all branches
  const canAccessAllBranches = (u: any): boolean => {
    return ['super_admin', 'general_manager', 'central_storekeeper', 'accountant', 'auditor', 'branch_operations_manager', 'hr_manager', 'facilities_manager'].includes(u?.role);
  };

  // Check if a branch is available for the user
  const isBranchAvailable = React.useCallback((branchId: number): boolean => {
    if (branchId === 0) return canAccessAllBranches(user);
    return userBranches.some(branch => branch.id === branchId);
  }, [user, userBranches]);

  // Set active branch
  const setActiveBranch = React.useCallback((branchId: number) => {
    if (isBranchAvailable(branchId) || branchId === 0) {
      setActiveBranchId(branchId);
      localStorage.setItem('activeBranchId', branchId.toString());
    }
  }, [isBranchAvailable]);

  // Check if a branch is active
  const isBranchActive = React.useCallback((branchId: number): boolean => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.status === 'active';
  }, [branches]);

  // Fetch branches from API
  const fetchBranches = React.useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');

      // Fetch all branches from API
      const branchesResponse = await fetch(`${API_URL}/api/system/branches`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (branchesResponse.ok) {
        const data = await branchesResponse.json();
        const allBranches = data.data || [];
        setBranches(allBranches);

        // Store branches for potential offline/demo use
        localStorage.setItem('branches', JSON.stringify(allBranches));

        // Determine user's branch access based on role
        let accessibleBranches: Branch[] = [];

        // Super admins, general managers, and central ops have access to all branches
        if (['super_admin', 'general_manager', 'central_storekeeper', 'accountant', 'auditor', 'branch_operations_manager'].includes(user.role)) {
          accessibleBranches = allBranches;
        } else if (user.branch_id) {
          // Branch-specific users only see their assigned branch
          accessibleBranches = allBranches.filter(
            (branch: Branch) => branch.id === user.branch_id
          );
        } else {
          // Fallback: if no branch_id, show all branches (shouldn't happen in production)
          accessibleBranches = allBranches;
        }

        setUserBranches(accessibleBranches);
        localStorage.setItem('userBranches', JSON.stringify(accessibleBranches));
      }
    } catch (error) {
      console.error('Error fetching branches:', error);

      // Try to use cached branch data if available
      try {
        const cachedBranches = localStorage.getItem('branches');
        const cachedUserBranches = localStorage.getItem('userBranches');

        if (cachedBranches && cachedUserBranches) {
          console.log('Using cached branch data after API error');
          const allBranches = JSON.parse(cachedBranches);
          const accessibleBranches = JSON.parse(cachedUserBranches);

          setBranches(allBranches);
          setUserBranches(accessibleBranches);
          return;
        }
      } catch (e) {
        console.error('Error parsing cached branch data:', e);
      }

      setBranches([]);
      setUserBranches([]);
      console.warn('Failed to load branch data. Please check network connection.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Check if user has access to branch
  const hasAccessToBranch = React.useCallback((branchId: number): boolean => {
    return userBranches.some(branch => branch.id === branchId);
  }, [userBranches]);

  // Fetch branches on mount or when user changes
  useEffect(() => {
    if (user) {
      fetchBranches();
    }
  }, [user, fetchBranches]);

  // Refresh branches
  const refreshBranches = React.useCallback(async () => {
    return fetchBranches();
  }, [fetchBranches]);

  const contextValue = React.useMemo(() => ({
    branches,
    userBranches,
    activeBranchId,
    activeBranch,
    setActiveBranch,
    isLoading,
    hasAccessToBranch,
    refreshBranches,
    isBranchActive
  }), [branches, userBranches, activeBranchId, activeBranch, isLoading, setActiveBranch, hasAccessToBranch, refreshBranches, isBranchActive]);

  return (
    <BranchContext.Provider value={contextValue}>
      {children}
    </BranchContext.Provider>
  );
}

// Custom hook to use branch context
export function useBranch() {
  const context = useContext(BranchContext);

  // Handle SSR by checking if we're on the client side
  if (context === undefined) {
    // Only throw an error if we're on the client side
    if (typeof window !== 'undefined') {
      console.error('BranchContext not found - component not wrapped in BranchProvider');
      throw new Error('useBranch must be used within a BranchProvider');
    }

    // Return a placeholder during SSR to prevent hydration errors
    return {
      branches: [],
      userBranches: [],
      activeBranchId: null,
      activeBranch: null,
      setActiveBranch: () => { },
      isLoading: true,
      hasAccessToBranch: () => false,
      refreshBranches: async () => { },
      isBranchActive: () => false
    };
  }

  return context;
}

// Single-branch roles that should NOT see the branch selector
const SINGLE_BRANCH_ROLES = [
  'branch_manager',
  'housekeeping',
  'housekeeping_supervisor',
  'maintenance',
  'receptionist',
  'restaurant',
  'pos_kitchen',
  'bartender',
  'branch_storekeeper',
  'pos_kitchen',
  'kitchen'
];

// Branch selector component
export function BranchSelector() {
  const { branches, userBranches, activeBranchId, setActiveBranch, isLoading } = useBranch();
  const { user } = useAuth();

  if (isLoading) {
    return <div className="h-8 w-48 bg-gray-100 animate-pulse rounded-md"></div>;
  }

  const branchesToShow = userBranches.length > 0 ? userBranches : branches;
  const isSingleBranchRole = user?.role && SINGLE_BRANCH_ROLES.includes(user.role);
  const canSeeAll = ['super_admin', 'general_manager', 'auditor', 'accountant'].includes(user?.role || '');

  if (branchesToShow.length === 0 || !user || isSingleBranchRole || (branchesToShow.length <= 1 && !canSeeAll)) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      <label className="text-sm font-medium text-gray-700">Branch:</label>
      <select
        value={activeBranchId === null ? '' : activeBranchId}
        onChange={(e) => setActiveBranch(parseInt(e.target.value))}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {canSeeAll && (
          <option value={0}>All Branches</option>
        )}
        {branchesToShow.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  );
}
