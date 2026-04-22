import apiClient from './client';

export const authApi = {
  // POST /api/auth/login
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }).then(r => r.data),

  // GET /api/auth/me
  me: () => apiClient.get('/auth/me').then(r => r.data),

  // PUT /api/auth/updatedetails
  updateDetails: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    address?: string;
    profilePhoto?: string;
  }) => apiClient.put('/auth/updatedetails', data).then(r => r.data),

  // PUT /api/auth/updatepassword
  updatePassword: (currentPassword: string, newPassword: string) =>
    apiClient.put('/auth/updatepassword', { currentPassword, newPassword }).then(r => r.data),

  // POST /api/auth/logout
  logout: () => apiClient.post('/auth/logout').then(r => r.data),

  // POST /api/auth/refresh-token
  refresh: (refreshToken: string) =>
    apiClient.post('/auth/refresh-token', { refresh_token: refreshToken }).then(r => r.data),
};
