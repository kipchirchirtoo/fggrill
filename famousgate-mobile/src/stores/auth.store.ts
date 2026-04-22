/**
 * Auth Store — Zustand
 *
 * Handles login, logout, and persisting the user session via SecureStore.
 *
 * Backend returns: { token, user } from POST /api/auth/login
 * We store token as access_token for the API client interceptor.
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export enum UserRole {
  CENTRAL_STOREKEEPER = 'central_storekeeper',
  BRANCH_STOREKEEPER = 'branch_storekeeper',
  CASHIER = 'cashier',
  AUDITOR = 'auditor',
  SUPERADMIN = 'super_admin',
  DRIVER = 'driver',
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole | string;
  branch_id?: string;
  branch_name?: string;
  branch?: { id: string; name: string };
  permissions?: string[];
  phone_number?: string;
  address?: string;
  profile_photo?: string;
  status?: string;
  password_changed_at?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: User;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (tokens: AuthTokens) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setUser: (user: User) => Promise<void>;
}

const normalizeUser = (user: User): User => ({
  ...user,
  branch_name: user.branch_name || user.branch?.name,
  branch_id: user.branch_id || user.branch?.id,
});

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async ({ access_token, refresh_token, user }) => {
    console.log('🔐 [AUTH STORE] Login called with user:', {
      email: user.email,
      role: user.role,
      id: user.id,
      branch_id: user.branch_id,
    });
    
    await SecureStore.setItemAsync('access_token', access_token);
    await SecureStore.setItemAsync('refresh_token', refresh_token || access_token);
    const normUser = normalizeUser(user);
    
    console.log('🔐 [AUTH STORE] Normalized user:', {
      email: normUser.email,
      role: normUser.role,
      id: normUser.id,
      branch_id: normUser.branch_id,
    });
    
    await SecureStore.setItemAsync('user', JSON.stringify(normUser));
    
    console.log('🔐 [AUTH STORE] Setting state - isAuthenticated: true, user:', normUser.email);
    set({ user: normUser, isAuthenticated: true, isLoading: false });
    
    console.log('✅ [AUTH STORE] Login complete');
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user');
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  setUser: async (user) => {
    const normUser = normalizeUser(user);
    await SecureStore.setItemAsync('user', JSON.stringify(normUser));
    set({ user: normUser, isAuthenticated: true, isLoading: false });
  },

  loadUser: async () => {
    console.log('📂 [AUTH STORE] Loading user from SecureStore...');
    try {
      const [userJson, token] = await Promise.all([
        SecureStore.getItemAsync('user'),
        SecureStore.getItemAsync('access_token'),
      ]);
      
      console.log('📂 [AUTH STORE] Retrieved from storage:', {
        hasUser: !!userJson,
        hasToken: !!token,
      });
      
      if (userJson && token) {
        const user = JSON.parse(userJson) as User;
        const normUser = normalizeUser(user);
        
        console.log('📂 [AUTH STORE] Loaded user:', {
          email: normUser.email,
          role: normUser.role,
          id: normUser.id,
        });
        
        set({ user: normUser, isAuthenticated: true, isLoading: false });
      } else {
        console.log('📂 [AUTH STORE] No stored user/token found');
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('❌ [AUTH STORE] Error loading user:', error);
      set({ isLoading: false });
    }
  },
}));
