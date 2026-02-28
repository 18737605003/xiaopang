import apiClient from './client';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    avatar?: string;
  };
  token: string;
}

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<any, LoginResponse>('/auth/login', data),
  
  logout: () =>
    apiClient.post('/auth/logout'),
  
  getCurrentUser: () =>
    apiClient.get('/auth/me'),
  
  refreshToken: () =>
    apiClient.post('/auth/refresh'),
};
