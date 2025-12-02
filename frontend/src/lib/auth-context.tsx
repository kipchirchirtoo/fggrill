'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// User roles for Famous Gate Hotel
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  GENERAL_MANAGER = 'general_manager',
  BRANCH_MANAGER = 'branch_manager',
  RECEPTIONIST = 'receptionist',
  HOUSEKEEPING = 'housekeeping',
  HOUSEKEEPING_SUPERVISOR = 'housekeeping_supervisor',
  RESTAURANT = 'restaurant',
  BARTENDER = 'bartender',
  MAINTENANCE = 'maintenance',
  ACCOUNTANT = 'accountant',
  AUDITOR = 'auditor',
  CENTRAL_STOREKEEPER = 'central_storekeeper',
  BRANCH_STOREKEEPER = 'branch_storekeeper',
  EMPLOYEE = 'employee',
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
}

// Auth context interface
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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
      const storedUser = localStorage.getItem('user');
      
      // If demo mode (token starts with 'demo-token-'), use stored user
      if (token && token.startsWith('demo-token-') && storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setIsLoading(false);
          return;
        } catch (e) {
          console.error('Failed to parse stored user:', e);
        }
      }
      
      if (token) {
        try {
          const res = await api.auth.getMe();
          if (res.success && res.data) {
            // Transform API user data to Context User interface if needed
            // Assuming API returns data matching the interface or close to it
            const apiUser = res.data;
            const userData: User = {
              id: apiUser.id,
              email: apiUser.email,
              firstName: apiUser.first_name, // Map snake_case to camelCase
              lastName: apiUser.last_name,
              role: apiUser.role as UserRole,
              branch_id: apiUser.branch_id,
              branch_name: apiUser.branch_name || 'Unknown Branch', // Handle potentially missing data
              is_central: apiUser.is_central,
              department: apiUser.department,
              permissions: apiUser.permissions
            };
            setUser(userData);
          } else {
            // Token invalid or expired
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          }
        } catch (error: any) {
          // In development, if backend is down, try to use stored user temporarily
          if (process.env.NODE_ENV === 'development' && storedUser && error.message?.includes('fetch')) {
            console.warn('Backend unreachable, using cached user (dev mode)');
            try {
              const userData = JSON.parse(storedUser);
              setUser(userData);
              return;
            } catch (e) {
              console.error('Failed to parse stored user:', e);
            }
          }
          
          // If API call fails (e.g. 401), clear session
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Demo accounts mapping for development
      const demoUsers: Record<string, User> = {
        // Development
        'admin@dev.com': {
          id: 'dev-admin-001',
          email: 'admin@dev.com',
          firstName: 'Dev',
          lastName: 'Admin',
          role: UserRole.SUPER_ADMIN,
          branch_id: null,
          branch_name: 'All Branches',
          is_central: true,
          department: 'Administration'
        },
        
        // Management
        'admin@famousgate.com': {
          id: 'admin-001',
          email: 'admin@famousgate.com',
          firstName: 'Super',
          lastName: 'Admin',
          role: UserRole.SUPER_ADMIN,
          branch_id: null,
          branch_name: 'All Branches',
          is_central: true,
          department: 'Administration'
        },
        'gm@famousgate.com': {
          id: 'gm-001',
          email: 'gm@famousgate.com',
          firstName: 'General',
          lastName: 'Manager',
          role: UserRole.GENERAL_MANAGER,
          branch_id: null,
          branch_name: 'All Branches',
          is_central: true,
          department: 'Management'
        },
        
        // Branch Managers
        'manager.bomet@famousgate.com': {
          id: 'mgr-bomet-001',
          email: 'manager.bomet@famousgate.com',
          firstName: 'Bomet',
          lastName: 'Manager',
          role: UserRole.BRANCH_MANAGER,
          branch_id: 1,
          branch_name: 'Famous Gate Bomet (Central)',
          is_central: true,
          department: 'Management'
        },
        'manager.kericho@famousgate.com': {
          id: 'mgr-kericho-001',
          email: 'manager.kericho@famousgate.com',
          firstName: 'Kericho',
          lastName: 'Manager',
          role: UserRole.BRANCH_MANAGER,
          branch_id: 3,
          branch_name: 'Famous Gate Kericho',
          is_central: false,
          department: 'Management'
        },
        'manager.litein@famousgate.com': {
          id: 'mgr-litein-001',
          email: 'manager.litein@famousgate.com',
          firstName: 'Litein',
          lastName: 'Manager',
          role: UserRole.BRANCH_MANAGER,
          branch_id: 6,
          branch_name: 'Famous Gate Litein',
          is_central: false,
          department: 'Management'
        },
        
        // Storekeeping
        'central@famousgate.com': {
          id: 'store-central-001',
          email: 'central@famousgate.com',
          firstName: 'Central',
          lastName: 'Storekeeper',
          role: UserRole.CENTRAL_STOREKEEPER,
          branch_id: 1,
          branch_name: 'Famous Gate Bomet (Central)',
          is_central: true,
          department: 'Storekeeping'
        },
        'store.bomet@famousgate.com': {
          id: 'store-bomet-001',
          email: 'store.bomet@famousgate.com',
          firstName: 'Bomet',
          lastName: 'Storekeeper',
          role: UserRole.BRANCH_STOREKEEPER,
          branch_id: 1,
          branch_name: 'Famous Gate Bomet (Central)',
          is_central: false,
          department: 'Storekeeping'
        },
        'store.kericho@famousgate.com': {
          id: 'store-kericho-001',
          email: 'store.kericho@famousgate.com',
          firstName: 'Kericho',
          lastName: 'Storekeeper',
          role: UserRole.BRANCH_STOREKEEPER,
          branch_id: 3,
          branch_name: 'Famous Gate Kericho',
          is_central: false,
          department: 'Storekeeping'
        },
        
        // Operations
        'reception@famousgate.com': {
          id: 'reception-001',
          email: 'reception@famousgate.com',
          firstName: 'Front',
          lastName: 'Desk',
          role: UserRole.RECEPTIONIST,
          branch_id: 1,
          branch_name: 'Famous Gate Bomet (Central)',
          is_central: false,
          department: 'Reception'
        },
        'housekeeping@famousgate.com': {
          id: 'housekeeping-001',
          email: 'housekeeping@famousgate.com',
          firstName: 'House',
          lastName: 'Keeper',
          role: UserRole.HOUSEKEEPING,
          branch_id: 1,
          branch_name: 'Famous Gate Bomet (Central)',
          is_central: false,
          department: 'Housekeeping'
        },
        'restaurant@famousgate.com': {
          id: 'restaurant-001',
          email: 'restaurant@famousgate.com',
          firstName: 'Restaurant',
          lastName: 'Staff',
          role: UserRole.RESTAURANT,
          branch_id: 1,
          branch_name: 'Famous Gate Bomet (Central)',
          is_central: false,
          department: 'Restaurant'
        },
        'maintenance@famousgate.com': {
          id: 'maintenance-001',
          email: 'maintenance@famousgate.com',
          firstName: 'Maintenance',
          lastName: 'Staff',
          role: UserRole.MAINTENANCE,
          branch_id: 1,
          branch_name: 'Famous Gate Bomet (Central)',
          is_central: false,
          department: 'Maintenance'
        },
        
        // Finance
        'accountant@famousgate.com': {
          id: 'accountant-001',
          email: 'accountant@famousgate.com',
          firstName: 'Chief',
          lastName: 'Accountant',
          role: UserRole.ACCOUNTANT,
          branch_id: null,
          branch_name: 'All Branches',
          is_central: true,
          department: 'Finance'
        },
        'auditor@famousgate.com': {
          id: 'auditor-001',
          email: 'auditor@famousgate.com',
          firstName: 'Internal',
          lastName: 'Auditor',
          role: UserRole.AUDITOR,
          branch_id: null,
          branch_name: 'All Branches',
          is_central: true,
          department: 'Finance'
        },
        
        // Bar
        'bar.bomet@famousgate.com': {
          id: 'bar-bomet-001',
          email: 'bar.bomet@famousgate.com',
          firstName: 'Bomet',
          lastName: 'Bartender',
          role: UserRole.BARTENDER,
          branch_id: 1,
          branch_name: 'Famous Gate Bomet (Central)',
          is_central: false,
          department: 'Bar & Lounge'
        },
        'bar.kericho@famousgate.com': {
          id: 'bar-kericho-001',
          email: 'bar.kericho@famousgate.com',
          firstName: 'Kericho',
          lastName: 'Bartender',
          role: UserRole.BARTENDER,
          branch_id: 3,
          branch_name: 'Famous Gate Kericho',
          is_central: false,
          department: 'Bar & Lounge'
        },
        'bar.litein@famousgate.com': {
          id: 'bar-litein-001',
          email: 'bar.litein@famousgate.com',
          firstName: 'Litein',
          lastName: 'Bartender',
          role: UserRole.BARTENDER,
          branch_id: 6,
          branch_name: 'Famous Gate Litein',
          is_central: false,
          department: 'Bar & Lounge'
        }
      };

      // Check if this is a demo account
      const demoUser = demoUsers[email];
      if (process.env.NODE_ENV === 'development' && demoUser) {
        localStorage.setItem('user', JSON.stringify(demoUser));
        localStorage.setItem('token', 'demo-token-' + Date.now());
        
        setUser(demoUser);
        toast.success(`Welcome, ${demoUser.firstName}! (Demo Mode)`);
        
        redirectToDashboard(demoUser.role, demoUser.is_central);
        return;
      }
      
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
          department: apiUser.department || 'Staff'
        };

        // Store user and token
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);

        setUser(userData);
        toast.success(`Welcome back, ${userData.firstName}!`);
        
        // Redirect to appropriate dashboard
        redirectToDashboard(userData.role, userData.is_central);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Provide helpful error message for development
      if (process.env.NODE_ENV === 'development') {
        toast.error(`Login failed: ${error.message}. Try clicking any demo account button below for instant access!`);
      } else {
        toast.error(error.message || 'Login failed');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      setUser(null);
      toast.info('Logged out successfully');
      router.push('/login');
    }
  };

  const redirectToDashboard = (role: UserRole, isCentral?: boolean) => {
    // Dynamic routing logic
    const roleRedirects: Record<UserRole, string> = {
      [UserRole.SUPER_ADMIN]: '/dashboard/admin',
      [UserRole.GENERAL_MANAGER]: '/dashboard/gm',
      [UserRole.BRANCH_MANAGER]: '/dashboard/branch-manager',
      [UserRole.RECEPTIONIST]: '/dashboard/reception',
      [UserRole.HOUSEKEEPING]: '/dashboard/housekeeping',
      [UserRole.HOUSEKEEPING_SUPERVISOR]: '/dashboard/housekeeping',
      [UserRole.RESTAURANT]: '/dashboard/restaurant',
      [UserRole.BARTENDER]: '/dashboard/bar',
      [UserRole.MAINTENANCE]: '/dashboard/maintenance',
      [UserRole.ACCOUNTANT]: '/dashboard/finance',
      [UserRole.AUDITOR]: '/dashboard/audit',
      [UserRole.CENTRAL_STOREKEEPER]: '/dashboard/central-store',
      [UserRole.BRANCH_STOREKEEPER]: '/dashboard/branch-store',
      [UserRole.EMPLOYEE]: '/dashboard',
      [UserRole.GUEST]: '/dashboard/guest'
    };
    
    const path = roleRedirects[role] || '/dashboard';
    router.push(path);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, checkAuth }}>
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
