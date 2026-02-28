import axios from 'axios';
import { useAuthStore, checkSessionExpiry } from '../store/authStore';
import { message } from 'antd';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    // 检查会话是否过期
    if (checkSessionExpiry()) {
      message.warning('会话已过期，请重新登录');
      window.location.href = '/login';
      return Promise.reject(new Error('Session expired'));
    }
    
    // 更新最后活动时间
    useAuthStore.getState().updateActivity();
    
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      message.error('登录已过期，请重新登录');
      window.location.href = '/login';
    } else if (error.response?.status === 403) {
      message.error('您没有权限执行此操作');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
