import { fetchAPI, fetchPythonAPI, buildQuery } from './core';
import { 
  ApiResponse, 
  User, 
  Role, 
  Branch, 
  Department, 
  AuthResponse,
  SystemNotification
} from './types';

// =====================================
// AUTHENTICATION API
// =====================================

export const authAPI = {
  login: (data: any) => 
    fetchAPI<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    
  logout: () => 
    fetchAPI<void>('/auth/logout', { method: 'POST' }),
  
  // POS Login with Offline Intercept
  posLogin: async (pin: string): Promise<ApiResponse<AuthResponse>> => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      try {
        const userData = await (window as any).electronAPI.cache.verifyPin(pin);
        if (userData) {
          return {
            success: true,
            data: { user: userData, session: { access_token: 'offline-bridge-token' } }
          };
        }
      } catch (e) {}
    }
    return fetchAPI<AuthResponse>('/auth/pos-login', { method: 'POST', body: JSON.stringify({ pin }) });
  },

  getMe: () => fetchAPI<User>('/auth/me'),
  updatePassword: (data: any) => fetchAPI<void>('/auth/updatepassword', { method: 'PUT', body: JSON.stringify(data) }),
};

// =====================================
// USER MANAGEMENT API
// =====================================

export const userAPI = {
  getUsers:   () => fetchAPI<User[]>('/users'),
  getUser:    (id: string) => fetchAPI<User>(`/users/${id}`),
  createUser: (data: any) => fetchAPI<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => fetchAPI<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) => fetchAPI<void>(`/users/${id}`, { method: 'DELETE' }),
  
  getProfile: () => fetchAPI<User>('/users/profile'),
  updateProfile: (data: any) => fetchAPI<User>('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),
  uploadProfilePhoto: (formData: FormData) => fetchAPI<{ photo_url: string }>('/users/profile/photo', {
    method: 'POST',
    body: formData,
  }),
};

// =====================================
// NOTIFICATIONS API
// =====================================

export const notificationsAPI = {
  getNotifications: (params?: any) => fetchAPI<SystemNotification[]>(`/notifications${buildQuery(params)}`),
  getUnreadCount:   () => fetchAPI<{ count: number }>('/notifications/unread-count'),
  markAsRead:       (id: number) => fetchAPI<void>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllAsRead:    () => fetchAPI<void>('/notifications/mark-all-read', { method: 'PATCH' }),
  clearNotifications: () => fetchAPI<void>('/notifications/clear-my-notifications', { method: 'DELETE' }),
  
  // Admin notifications
  createNotification: (data: any) => fetchAPI<SystemNotification>('/notifications', { method: 'POST', body: JSON.stringify(data) }),
  notifyRole: (data: any) => fetchAPI<void>('/notifications/notify-role', { method: 'POST', body: JSON.stringify(data) }),
  notifyBranch: (data: any) => fetchAPI<void>('/notifications/notify-branch', { method: 'POST', body: JSON.stringify(data) }),
};

// =====================================
// SYSTEM / TOOLS API
// =====================================

// ─── Base System Logic (Private to avoid recursive type inference issues) ────
const systemBase = {
  getBranches: () => fetchAPI<Branch[]>('/system/branches'),
  getBranch: (id: string | number) => fetchAPI<Branch>(`/system/branches/${id}`),
  createBranch: (data: any) => fetchAPI<Branch>('/system/branches', { method: 'POST', body: JSON.stringify(data) }),
  updateBranch: (id: string | number, data: any) => fetchAPI<Branch>(`/system/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBranch: (id: string | number) => fetchAPI<void>(`/system/branches/${id}`, { method: 'DELETE' }),
  
  getDepartments: () => fetchAPI<Department[]>('/system/departments'),
  getDepartment: (id: string | number) => fetchAPI<Department>(`/system/departments/${id}`),
  createDepartment: (data: any) => fetchAPI<Department>('/system/departments', { method: 'POST', body: JSON.stringify(data) }),
  updateDepartment: (id: string | number, data: any) => fetchAPI<Department>(`/system/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDepartment: (id: string | number) => fetchAPI<void>(`/system/departments/${id}`, { method: 'DELETE' }),
  
  getRoles: () => fetchAPI<Role[]>('/system/roles'),
  getRolePermissions: (roleId: string | number) => fetchAPI<string[]>(`/system/roles/${roleId}/permissions`),
  
  // Calls /system/users (permits SUPER_ADMIN, GM, HR_MANAGER, AUDITOR)
  getSystemUsers: () => fetchAPI<User[]>('/system/users'),
  
  getConfigs: (category?: string) => fetchAPI<any>(`/system/configs${buildQuery({ category })}`),
  updateConfig: (category: string, data: any) => fetchAPI<void>(`/system/configs/${category}`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const systemAPI = {
  ...systemBase,
};

export const idCardsAPI = {
  generate: async (data: any, photo?: File) => {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    if (photo) formData.append('photo', photo);

    const result = await fetchPythonAPI<Blob>('/id-cards/generate', {
      method: 'POST',
      body: formData,
      responseType: 'blob'
    });
    return result.data;
  },
  
  preview: async (data: any, photo?: File) => {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    if (photo) formData.append('photo', photo);

    const result = await fetchPythonAPI<Blob>('/id-cards/preview', {
      method: 'POST',
      body: formData,
      responseType: 'blob'
    });
    return result.data;
  },
};

export const documentsAPI = {
  getGuestDocuments: (guestId: string) => 
    fetchAPI<any[]>(`/documents/guest/${guestId}`),
    
  uploadDocument: (file: File, guestId: string, docType: string, reservationId?: string) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('guest_id', guestId);
    formData.append('document_type', docType);
    if (reservationId) formData.append('reservation_id', reservationId);
    
    return fetchAPI<any>('/documents/upload', {
      method: 'POST',
      body: formData,
      // Note: fetchAPI handles FormData without setting Content-Type header
    });
  },
  
  deleteDocument: (id: string) => 
    fetchAPI<void>(`/documents/${id}`, { method: 'DELETE' }),
    
  getDocumentsSnapshot: (params?: any) => 
    fetchAPI<any[]>(`/documents${buildQuery(params)}`),
};

export const channelManagerAPI = {
  getSyncStatus: () => systemAPI.getConfigs('channel_manager'),
  toggleChannel: (id: string, enabled: boolean) => systemAPI.updateConfig('channel_manager', { id, enabled }),
  syncAllChannels: () => fetchAPI<void>('/system/configs/channel_manager/sync', { method: 'POST' }),
  pushAvailability: (id: string, data: any) => fetchAPI<void>(`/system/configs/channel_manager/${id}/push`, { method: 'POST', body: JSON.stringify(data) }),
  pullBookings: (id: string) => fetchAPI<any>(`/system/configs/channel_manager/${id}/pull`, { method: 'POST' }),
};
