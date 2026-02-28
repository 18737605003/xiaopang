import apiClient from './client';

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  department?: string;
  status: 'active' | 'inactive';
  quota: number;
  usedQuota: number;
  createdAt: string;
}

export const usersApi = {
  getUsers: (params?: { page?: number; pageSize?: number; search?: string }) =>
    apiClient.get('/users', { params }),
  
  getUserById: (id: string) =>
    apiClient.get(`/users/${id}`),
  
  createUser: (data: Partial<User>) =>
    apiClient.post('/users', data),
  
  updateUser: (id: string, data: Partial<User>) =>
    apiClient.put(`/users/${id}`, data),
  
  deleteUser: (id: string) =>
    apiClient.delete(`/users/${id}`),
  
  updateQuota: (id: string, quota: number) =>
    apiClient.patch(`/users/${id}/quota`, { quota }),
};
