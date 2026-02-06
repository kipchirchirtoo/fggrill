'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// User roles for Famous Gate Hotel
export enum UserRole {
  // Admin roles
  SUPER_ADMIN = 'super_admin',

  // Legacy roles - to be migrated
  GENERAL_MANAGER = 'general_manager',
  BRANCH_MANAGER = 'branch_manager',
  CENTRAL_STOREKEEPER = 'central_storekeeper',
  BRANCH_STOREKEEPER = 'branch_storekeeper',
  HOUSEKEEPING = 'housekeeping',
  HOUSEKEEPING_SUPERVISOR = 'housekeeping_supervisor',
  MAINTENANCE = 'maintenance',

  // New consolidated roles
  BRANCH_OPERATIONS_MANAGER = 'branch_operations_manager',
  CENTRAL_OPERATIONS_MANAGER = 'central_operations_manager',
  FACILITIES_MANAGER = 'facilities_manager',

  // Other roles
  RECEPTIONIST = 'receptionist',
  RESTAURANT = 'restaurant',
  POS_KITCHEN = 'pos_kitchen',
  KITCHEN = 'kitchen',
  KITCHEN_OPERATIONS = 'kitchen_operations',
  BARTENDER = 'bartender',
  WAITER = 'waiter',
  WAITRESS = 'waitress',
  HEAD_WAITER = 'head_waiter',
  BARMAN = 'barman',
  BARMAID = 'barmaid',
  BAR_MANAGER = 'bar_manager',
  CHEF = 'chef',
  HEAD_CHEF = 'head_chef',
  COOK = 'cook',
  ACCOUNTANT = 'accountant',
  BRANCH_ACCOUNTANT = 'branch_accountant',
  AUDITOR = 'auditor',
  PROCUREMENT = 'procurement',
  STOREKEEPER = 'storekeeper',
  PURCHASING_MANAGER = 'purchasing_manager',
  CASHIER = 'cashier',
  HR_MANAGER = 'hr_manager',
  EMPLOYEE = 'employee',
  DRIVER = 'driver',
  GUEST = 'guest'
}

// User interface
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  permissions?: string[];
  branch_id?: number | null;
  branch_name?: string;
  is_central?: boolean;
  isPosLogin?: boolean;
  lastLoginAt?: string;
  employeeId?: string;
  startDate?: string;
  profilePhoto?: string;
  idNumber?: string;
  phoneNumber?: string;
}

// Auth context interface
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  posLogin: (pin: string, redirectTo?: string) => Promise<void>;
  logout: (redirectTo?: string) => void;
  checkAuth: () => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider Component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Handle mounting to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    if (mounted) {
      checkAuth();
    }
  }, [mounted]);

  const checkAuth = async () => {
    try {
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const cachedUser = localStorage.getItem('user');

      if (token) {
        // First, restore cached user immediately to prevent flash of logged-out state
        if (cachedUser) {
          try {
            const parsedUser = JSON.parse(cachedUser);
            setUser(parsedUser);
          } catch (e) {
            // Invalid cached user, continue to API check
          }
        }

        try {
          const res = await api.auth.getMe();
          if (res.success && res.data) {
            const apiUser = res.data;
            const userData: User = {
              id: apiUser.id,
              email: apiUser.email,
              firstName: apiUser.first_name,
              lastName: apiUser.last_name,
              role: apiUser.role as UserRole,
              branch_id: apiUser.branch_id,
              branch_name: apiUser.branch_name || 'Unknown Branch',
              is_central: apiUser.is_central,
              department: apiUser.department,
              permissions: apiUser.permissions,
              employeeId: apiUser.employee_id,
              startDate: apiUser.start_date,
              profilePhoto: apiUser.profile_photo,
              idNumber: apiUser.id_number,
              phoneNumber: apiUser.phone_number
            };
            setUser(userData);
            // Update cached user with fresh data
            localStorage.setItem('user', JSON.stringify(userData));
          } else if (res.message?.includes('expired') || res.message?.includes('invalid')) {
            // Only clear on explicit token expiry/invalid messages
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          }
          // If res.success is false but not due to token issues, keep cached user
        } catch (error: any) {
          // Only clear session on 401 Unauthorized errors
          const is401 = error.message?.includes('401') || error.message?.includes('Unauthorized') || error.message?.includes('expired');
          if (is401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          }
          // For network errors or server errors, keep the cached user
          // This prevents logout on page reload when backend is slow to start
          console.warn('Auth check failed, keeping cached session:', error.message);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const res = await api.auth.login({ email, password });

      if (res.success && res.data) {
        const { user: apiUser, session } = res.data;
        const token = session.access_token;

        const userData: User = {
          id: apiUser.id,
          email: apiUser.email,
          firstName: apiUser.first_name,
          lastName: apiUser.last_name,
          role: apiUser.role as UserRole,
          branch_id: apiUser.branch_id,
          branch_name: apiUser.branch_name || (apiUser.branch_id ? 'Branch' : 'HQ'),
          is_central: apiUser.is_central || false,
          department: apiUser.department || 'Staff',
          employeeId: apiUser.employee_id,
          startDate: apiUser.start_date,
          profilePhoto: apiUser.profile_photo,
          idNumber: apiUser.id_number,
          phoneNumber: apiUser.phone_number
        };

        // Store user and token
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);

        // Set branch context
        if (userData.branch_id) {
          localStorage.setItem('activeBranchId', userData.branch_id.toString());
        }

        setUser(userData);
        toast.success(`Welcome back, ${userData.firstName}!`);

        // Redirect to appropriate dashboard
        redirectToDashboard(userData.role, userData.is_central);
      } else {
        throw new Error(res.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Invalid email or password');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const posLogin = async (pin: string, redirectTo?: string): Promise<void> => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const res = await api.auth.posLogin(pin);

      if (res.success && res.data) {
        const { user: apiUser, session } = res.data;
        const token = session?.access_token || res.data.token;

        const userData: User = {
          id: apiUser.id,
          email: apiUser.email || '',
          firstName: apiUser.first_name,
          lastName: apiUser.last_name,
          role: apiUser.role as UserRole,
          branch_id: apiUser.branch_id,
          branch_name: apiUser.branch_name || (apiUser.branch_id ? 'Branch' : 'HQ'),
          is_central: apiUser.is_central || false,
          isPosLogin: true,
          lastLoginAt: new Date().toISOString(),
          department: apiUser.department || 'Staff'
        };

        // Store user and token
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);

        // Set branch context
        if (userData.branch_id) {
          localStorage.setItem('activeBranchId', userData.branch_id.toString());
        }

        setUser(userData);
        toast.success(`Signed in as ${userData.firstName}`);

        // Redirect to appropriate dashboard or specific module
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          redirectToDashboard(userData.role, userData.is_central);
        }
      } else {
        throw new Error(res.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('POS Login error:', error);
      toast.error(error.message || 'Invalid PIN');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (redirectTo: string = '/login') => {
    try {
      await api.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      setUser(null);
      toast.info('Logged out successfully');
      router.push(redirectTo);
    }
  };

  const redirectToDashboard = (role: UserRole, isCentral?: boolean) => {
    // Dynamic routing logic
    const roleRedirects: Record<UserRole, string> = {
      // Admin roles
      [UserRole.SUPER_ADMIN]: '/dashboard/admin',

      // Legacy roles - to be migrated
      [UserRole.GENERAL_MANAGER]: '/dashboard/gm',
      [UserRole.BRANCH_MANAGER]: '/dashboard/branch-manager',
      [UserRole.CENTRAL_STOREKEEPER]: '/dashboard/central-store',
      [UserRole.BRANCH_STOREKEEPER]: '/dashboard/branch-store',
      [UserRole.HOUSEKEEPING]: '/dashboard/housekeeping',
      [UserRole.HOUSEKEEPING_SUPERVISOR]: '/dashboard/housekeeping',
      [UserRole.MAINTENANCE]: '/dashboard/maintenance',

      // New consolidated roles
      [UserRole.BRANCH_OPERATIONS_MANAGER]: '/dashboard/branch-operations',
      [UserRole.CENTRAL_OPERATIONS_MANAGER]: '/dashboard/central-store',
      [UserRole.FACILITIES_MANAGER]: '/dashboard/facilities',

      // Other roles
      [UserRole.RECEPTIONIST]: '/dashboard/reception',
      [UserRole.RESTAURANT]: '/dashboard/pos-kitchen',
      [UserRole.POS_KITCHEN]: '/dashboard/pos-kitchen',
      [UserRole.KITCHEN]: '/dashboard/kitchen',
      [UserRole.KITCHEN_OPERATIONS]: '/dashboard/kitchen-operations',
      [UserRole.BARTENDER]: '/dashboard/pos-kitchen?tab=bar',
      [UserRole.BARMAN]: '/dashboard/pos-kitchen?tab=bar',
      [UserRole.BARMAID]: '/dashboard/pos-kitchen?tab=bar',
      [UserRole.BAR_MANAGER]: '/dashboard/pos-kitchen?tab=bar',
      [UserRole.WAITER]: '/dashboard/pos-kitchen?tab=restaurant',
      [UserRole.WAITRESS]: '/dashboard/pos-kitchen?tab=restaurant',
      [UserRole.HEAD_WAITER]: '/dashboard/pos-kitchen?tab=restaurant',
      [UserRole.CHEF]: '/dashboard/kitchen',
      [UserRole.HEAD_CHEF]: '/dashboard/kitchen',
      [UserRole.COOK]: '/dashboard/kitchen',
      [UserRole.ACCOUNTANT]: '/dashboard/branch-accounting',
      [UserRole.BRANCH_ACCOUNTANT]: '/dashboard/branch-accounting',
      [UserRole.AUDITOR]: '/dashboard/auditor',
      [UserRole.PROCUREMENT]: '/dashboard/procurement',
      [UserRole.STOREKEEPER]: '/dashboard/storekeeping',
      [UserRole.PURCHASING_MANAGER]: '/dashboard/procurement',
      [UserRole.CASHIER]: '/dashboard/cashier',
      [UserRole.HR_MANAGER]: '/dashboard/hr',
      [UserRole.EMPLOYEE]: '/dashboard/employee',
      [UserRole.DRIVER]: '/dashboard/employee',
      [UserRole.GUEST]: '/dashboard/guest',
    };

    const path = roleRedirects[role] || '/dashboard';
    router.push(path);
  };

  const authValue = React.useMemo(() => ({
    user,
    isLoading,
    login,
    posLogin,
    logout,
    checkAuth
  }), [user, isLoading]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Permission checker utility
export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;

  // Super admin has all permissions
  if (user.role === UserRole.SUPER_ADMIN) return true;

  // Check specific permissions
  return user.permissions?.includes(permission) || false;
}

// Role checker utility
export function hasRole(user: User | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
