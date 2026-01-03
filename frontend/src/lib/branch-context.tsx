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
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Branch Provider Component
export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userBranches, setUserBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate the active branch object
  const activeBranch = activeBranchId
    ? branches.find(branch => branch.id === activeBranchId) || null
    : null;

  // Fetch branches on mount or when user changes
  useEffect(() => {
    if (user) {
      fetchBranches();
    }
  }, [user]);

  // Set the initial active branch from local storage or user's primary branch
  useEffect(() => {
    if (branches.length && user) {
      const storedBranchId = localStorage.getItem('activeBranchId');

      if (storedBranchId && isBranchAvailable(parseInt(storedBranchId))) {
        setActiveBranchId(parseInt(storedBranchId));
      } else if (user.branch_id && isBranchAvailable(user.branch_id)) {
        // Use user's assigned branch
        setActiveBranchId(user.branch_id);
      } else if (userBranches.length > 0) {
        // Fallback to first accessible branch
        setActiveBranchId(userBranches[0].id);
      }
    }
  }, [branches, user, userBranches]);

  // Check if a branch is available for the user
  const isBranchAvailable = (branchId: number): boolean => {
    return userBranches.some(branch => branch.id === branchId);
  };

  // Check if a branch is active
  const isBranchActive = (branchId: number): boolean => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.status === 'active';
  };

  // Fetch branches from API
  const fetchBranches = async () => {
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
        if (['super_admin', 'general_manager', 'central_operations_manager', 'central_storekeeper', 'accountant', 'auditor', 'branch_operations_manager'].includes(user.role)) {
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

      // If no cached data is available or it failed to parse
      setBranches([]);
      setUserBranches([]);

      // Don't show alerts that disrupt the UX
      console.warn('Failed to load branch data. Please check network connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Set active branch and store in local storage
  const setActiveBranch = (branchId: number) => {
    if (isBranchAvailable(branchId)) {
      setActiveBranchId(branchId);
      localStorage.setItem('activeBranchId', branchId.toString());
    }
  };

  // Check if user has access to branch
  const hasAccessToBranch = (branchId: number): boolean => {
    return userBranches.some(branch => branch.id === branchId);
  };

  // Refresh branches list
  const refreshBranches = async () => {
    return fetchBranches();
  };

  return (
    <BranchContext.Provider value={{
      branches,
      userBranches,
      activeBranchId,
      activeBranch,
      setActiveBranch,
      isLoading,
      hasAccessToBranch,
      refreshBranches,
      isBranchActive
    }}>
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
];

// Branch selector component
export function BranchSelector() {
  const { branches, userBranches, activeBranchId, activeBranch, setActiveBranch, isLoading } = useBranch();
  const { user } = useAuth();

  if (isLoading) {
    return <div className="h-8 w-48 bg-gray-100 animate-pulse rounded-md"></div>;
  }

  // Use all branches if user has access to multiple, otherwise show current branch
  const branchesToShow = userBranches.length > 0 ? userBranches : branches;

  // Hide for single-branch roles
  const isSingleBranchRole = user?.role && SINGLE_BRANCH_ROLES.includes(user.role);

  // Hide if: no branches, no user, single-branch role, or only one branch
  if (branchesToShow.length === 0 || !user || isSingleBranchRole || branchesToShow.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      <label className="text-sm font-medium text-gray-700">Branch:</label>
      <select
        value={activeBranchId || ''}
        onChange={(e) => setActiveBranch(parseInt(e.target.value))}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {branchesToShow.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  );
}
