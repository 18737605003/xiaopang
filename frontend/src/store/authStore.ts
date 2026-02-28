import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  lastActivity: number;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  updateActivity: () => void;
}

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10分钟

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      lastActivity: Date.now(),
      login: (user, token) =>
        set({ user, token, isAuthenticated: true, lastActivity: Date.now() }),
      logout: () =>
        set({ user: null, token: null, isAuthenticated: false, lastActivity: 0 }),
      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
      updateActivity: () =>
        set({ lastActivity: Date.now() }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

// 检查会话是否过期
export const checkSessionExpiry = () => {
  const { lastActivity, isAuthenticated, logout } = useAuthStore.getState();
  
  if (isAuthenticated && Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
    logout();
    return true;
  }
  
  return false;
};
