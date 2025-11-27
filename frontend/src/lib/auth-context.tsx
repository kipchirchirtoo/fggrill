'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// User roles for Famous Gate Hotel
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  GENERAL_MANAGER = 'general_manager',
  BRANCH_MANAGER = 'branch_manager',
  RECEPTIONIST = 'receptionist',
  HOUSEKEEPING = 'housekeeping',
  RESTAURANT = 'restaurant',
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

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Demo login credentials
const DEMO_USERS = [
  // === ADMINISTRATION ===
  {
    id: 'admin-1',
    email: 'admin@famousgate.com',
    password: 'admin123',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.SUPER_ADMIN,
    department: 'IT Administration',
    branch_id: null,
    branch_name: 'All Branches'
  },
  {
    id: 'gm-1',
    email: 'gm@famousgate.com',
    password: 'gm123',
    firstName: 'Jane',
    lastName: 'Muthoni',
    role: UserRole.GENERAL_MANAGER,
    department: 'Executive Management',
    branch_id: null,
    branch_name: 'All Branches'
  },
  // === BRANCH MANAGERS ===
  {
    id: 'bm-bomet-1',
    email: 'manager.bomet@famousgate.com',
    password: 'bomet123',
    firstName: 'Samuel',
    lastName: 'Kipchoge',
    role: UserRole.BRANCH_MANAGER,
    department: 'Branch Management',
    branch_id: 1,
    branch_name: 'Famous Gate Bomet (HQ)'
  },
  {
    id: 'bm-kericho-1',
    email: 'manager.kericho@famousgate.com',
    password: 'kericho123',
    firstName: 'Grace',
    lastName: 'Chebet',
    role: UserRole.BRANCH_MANAGER,
    department: 'Branch Management',
    branch_id: 3,
    branch_name: 'Famous Gate Kericho'
  },
  {
    id: 'bm-litein-1',
    email: 'manager.litein@famousgate.com',
    password: 'litein123',
    firstName: 'Daniel',
    lastName: 'Kosgei',
    role: UserRole.BRANCH_MANAGER,
    department: 'Branch Management',
    branch_id: 6,
    branch_name: 'Famous Gate Litein'
  },
  // === CENTRAL WAREHOUSE ===
  {
    id: 'central-store-1',
    email: 'central@famousgate.com',
    password: 'central123',
    firstName: 'Peter',
    lastName: 'Kimani',
    role: UserRole.CENTRAL_STOREKEEPER,
    department: 'Central Warehouse',
    branch_id: 1,
    branch_name: 'Central Warehouse (Bomet HQ)'
  },
  // === BRANCH STOREKEEPERS ===
  {
    id: 'branch-store-bomet',
    email: 'store.bomet@famousgate.com',
    password: 'store123',
    firstName: 'Mary',
    lastName: 'Wanjiku',
    role: UserRole.BRANCH_STOREKEEPER,
    department: 'Branch Store',
    branch_id: 2,
    branch_name: 'Famous Gate Bomet Town'
  },
  {
    id: 'branch-store-kericho',
    email: 'store.kericho@famousgate.com',
    password: 'store123',
    firstName: 'James',
    lastName: 'Korir',
    role: UserRole.BRANCH_STOREKEEPER,
    department: 'Branch Store',
    branch_id: 3,
    branch_name: 'Famous Gate Kericho'
  },
  {
    id: 'branch-store-kapsoit',
    email: 'store.kapsoit@famousgate.com',
    password: 'store123',
    firstName: 'Alice',
    lastName: 'Tanui',
    role: UserRole.BRANCH_STOREKEEPER,
    department: 'Branch Store',
    branch_id: 4,
    branch_name: 'Famous Gate Kapsoit'
  },
  // === FINANCE ===
  {
    id: 'accountant-1',
    email: 'accountant@famousgate.com',
    password: 'account123',
    firstName: 'Emily',
    lastName: 'Davis',
    role: UserRole.ACCOUNTANT,
    department: 'Finance',
    branch_id: null,
    branch_name: 'All Branches'
  },
  {
    id: 'auditor-1',
    email: 'auditor@famousgate.com',
    password: 'audit123',
    firstName: 'David',
    lastName: 'Anderson',
    role: UserRole.AUDITOR,
    department: 'Audit',
    branch_id: null,
    branch_name: 'All Branches'
  },
  // === OPERATIONS ===
  {
    id: 'reception-1',
    email: 'reception@famousgate.com',
    password: 'reception123',
    firstName: 'Mike',
    lastName: 'Johnson',
    role: UserRole.RECEPTIONIST,
    department: 'Front Desk',
    branch_id: 1,
    branch_name: 'Famous Gate Bomet (HQ)'
  },
  {
    id: 'housekeeping-1',
    email: 'housekeeping@famousgate.com',
    password: 'house123',
    firstName: 'Sarah',
    lastName: 'Wilson',
    role: UserRole.HOUSEKEEPING,
    department: 'Housekeeping',
    branch_id: 1,
    branch_name: 'Famous Gate Bomet (HQ)'
  },
  {
    id: 'restaurant-1',
    email: 'restaurant@famousgate.com',
    password: 'rest123',
    firstName: 'Tom',
    lastName: 'Brown',
    role: UserRole.RESTAURANT,
    department: 'Restaurant & Kitchen',
    branch_id: 1,
    branch_name: 'Famous Gate Bomet (HQ)'
  },
  {
    id: 'maintenance-1',
    email: 'maintenance@famousgate.com',
    password: 'maint123',
    firstName: 'Bob',
    lastName: 'Miller',
    role: UserRole.MAINTENANCE,
    department: 'Maintenance',
    branch_id: 1,
    branch_name: 'Famous Gate Bomet (HQ)'
  }
];

// Auth Provider Component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      // Check for stored session
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      
      if (storedUser && token) {
        // For demo purposes, always accept stored user
        const userData = JSON.parse(storedUser);
        setUser(userData);
        // Don't redirect here - let individual pages handle redirects
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // For demo purposes, use demo users
      const demoUser = DEMO_USERS.find(u => u.email === email && u.password === password);
      
      if (!demoUser) {
        throw new Error('Invalid credentials');
      }

      // Create user object
      const userData: User = {
        id: demoUser.id,
        email: demoUser.email,
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        role: demoUser.role,
        department: demoUser.department,
        branch_id: (demoUser as any).branch_id || null,
        branch_name: (demoUser as any).branch_name || null,
        is_central: (demoUser as any).is_central || false
      };

      // Store user and demo token
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', `demo-token-${demoUser.id}`);

      setUser(userData);
      toast.success(`Welcome back, ${userData.firstName}!`);
      
      // Redirect to appropriate dashboard
      redirectToDashboard(userData.role, userData.is_central);
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    toast.info('Logged out successfully');
    router.push('/login');
  };

  const redirectToDashboard = (role: UserRole, isCentral?: boolean) => {
    const roleRedirects: Record<UserRole, string> = {
      [UserRole.SUPER_ADMIN]: '/dashboard/admin',
      [UserRole.GENERAL_MANAGER]: '/dashboard/gm',
      [UserRole.BRANCH_MANAGER]: '/dashboard/branch-manager',
      [UserRole.RECEPTIONIST]: '/dashboard/reception',
      [UserRole.HOUSEKEEPING]: '/dashboard/housekeeping',
      [UserRole.RESTAURANT]: '/dashboard/restaurant',
      [UserRole.MAINTENANCE]: '/dashboard/maintenance',
      [UserRole.ACCOUNTANT]: '/dashboard/finance',
      [UserRole.AUDITOR]: '/dashboard/audit',
      [UserRole.CENTRAL_STOREKEEPER]: '/dashboard/central-store',
      [UserRole.BRANCH_STOREKEEPER]: '/dashboard/branch-store',
      [UserRole.EMPLOYEE]: '/dashboard',
      [UserRole.GUEST]: '/dashboard/guest'
    };
    
    router.push(roleRedirects[role] || '/dashboard');
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
