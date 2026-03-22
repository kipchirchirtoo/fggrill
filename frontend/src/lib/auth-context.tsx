'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { UserRole } from '@/lib/user-roles';

// Re-export UserRole so existing imports from '@/lib/auth-context' still work
export { UserRole } from '@/lib/user-roles';



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
  isAuthenticating: boolean;
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
  const [isAuthenticating, setIsAuthenticating] = useState(false);
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

  const checkAuth = useCallback(async () => {
    try {
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const cachedUser = localStorage.getItem('user');

      // Clear invalid token strings
      if (token === 'undefined' || token === 'null') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setIsLoading(false);
        return;
      }

      if (token) {
        setIsLoading(true);

        if (cachedUser) {
          try {
            const parsedUser = JSON.parse(cachedUser);
            setUser(parsedUser);
          } catch (e) {
            // cached user parse failed, will re-fetch
          }
        }

        if (token === 'offline-bridge-token') {
          setIsLoading(false);
          return;
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
            localStorage.setItem('user', JSON.stringify(userData));
          } else if (res.message?.includes('expired') || res.message?.includes('invalid')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          }
        } catch (error: any) {
          const is401 = error.message?.includes('401') || error.message?.includes('Unauthorized') || error.message?.includes('expired');
          if (is401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          }
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('[Auth V3] Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);

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

        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);

        if (userData.branch_id) {
          localStorage.setItem('activeBranchId', userData.branch_id.toString());
        }

        setUser(userData);
        toast.success(`Welcome back, ${userData.firstName}!`);
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
  }, [router]);

  const posLogin = useCallback(async (pin: string, redirectTo?: string): Promise<void> => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);

    try {
      const res = await api.auth.posLogin(pin);
      if (res.success && res.data) {
        const { user: apiUser, session } = res.data;
        const token = session?.access_token || (res.data as any).token;

        if (!token) {
          throw new Error('No access token received');
        }

        const userData: User = {
          id: apiUser.id,
          email: apiUser.email || '',
          firstName: apiUser.first_name || apiUser.firstName || '',
          lastName: apiUser.last_name || apiUser.lastName || '',
          role: apiUser.role as UserRole,
          branch_id: apiUser.branch_id ?? null,
          branch_name: apiUser.branch_name || (apiUser.branch_id ? 'Branch' : 'HQ'),
          is_central: apiUser.is_central || false,
          isPosLogin: true,
          lastLoginAt: new Date().toISOString(),
          department: apiUser.department || 'Staff'
        };

        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);

        if (userData.branch_id) {
          localStorage.setItem('activeBranchId', userData.branch_id.toString());
        }

        setUser(userData);
        toast.success(`Signed in as ${userData.firstName}`);
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
      setIsAuthenticating(false);
    }
  }, [router]);

  const logout = useCallback(async (redirectTo: string = '/login') => {
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
  }, [router]);

  const redirectToDashboard = (role: UserRole, isCentral?: boolean) => {
    const roleRedirects: Record<UserRole, string> = {
      [UserRole.SUPER_ADMIN]: '/dashboard/admin',
      [UserRole.GENERAL_MANAGER]: '/dashboard/gm',
      [UserRole.BRANCH_MANAGER]: '/dashboard/branch-manager',
      [UserRole.CENTRAL_STOREKEEPER]: '/dashboard/central-store',
      [UserRole.BRANCH_STOREKEEPER]: '/dashboard/branch-store',
      [UserRole.HOUSEKEEPING]: '/dashboard/housekeeping',
      [UserRole.HOUSEKEEPING_SUPERVISOR]: '/dashboard/housekeeping',
      [UserRole.MAINTENANCE]: '/dashboard/maintenance',
      [UserRole.BRANCH_OPERATIONS_MANAGER]: '/dashboard/branch-operations',
      [UserRole.CENTRAL_OPERATIONS_MANAGER]: '/dashboard/central-store',
      [UserRole.FACILITIES_MANAGER]: '/dashboard/facilities',
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
      [UserRole.KYOGONG_SPA_CASHIER]: '/dashboard/kyogong/spa',
      [UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER]: '/dashboard/kyogong/executive-bar',
      [UserRole.KYOGONG_SPORTS_BAR_CASHIER]: '/dashboard/kyogong/sports-bar',
      [UserRole.KYOGONG_RECEPTION_CASHIER]: '/dashboard/kyogong/reception',
    };

    const path = roleRedirects[role] || '/dashboard';
    router.push(path);
  };

  const authValue = React.useMemo(() => ({
    user,
    isLoading,
    isAuthenticating,
    login,
    posLogin,
    logout,
    checkAuth
  }), [user, isLoading, login, posLogin, logout, checkAuth]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;
  if (user.role === UserRole.SUPER_ADMIN) return true;
  return user.permissions?.includes(permission) || false;
}

export function hasRole(user: User | null, roles: UserRole[]): boolean {
  if (!user) return false;

  const userRole = (user.role as string).toLowerCase().trim();
  const normalizedRoles = roles.map(r => (r as string).toLowerCase().trim());

  return normalizedRoles.includes(userRole);
}
