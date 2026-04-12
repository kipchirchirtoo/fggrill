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
  SUPERADMIN = 'super_admin',
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
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async ({ access_token, refresh_token, user }) => {
    await SecureStore.setItemAsync('access_token', access_token);
    await SecureStore.setItemAsync('refresh_token', refresh_token || access_token);
    await SecureStore.setItemAsync('user', JSON.stringify(user));
    // Normalise branch_name from nested branch object
    const normUser: User = {
      ...user,
      branch_name: user.branch_name || user.branch?.name,
      branch_id: user.branch_id || user.branch?.id,
    };
    set({ user: normUser, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user');
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  loadUser: async () => {
    try {
      const [userJson, token] = await Promise.all([
        SecureStore.getItemAsync('user'),
        SecureStore.getItemAsync('access_token'),
      ]);
      if (userJson && token) {
        const user = JSON.parse(userJson) as User;
        const normUser: User = {
          ...user,
          branch_name: user.branch_name || user.branch?.name,
          branch_id: user.branch_id || user.branch?.id,
        };
        set({ user: normUser, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
