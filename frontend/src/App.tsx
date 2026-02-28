import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useAuthStore, checkSessionExpiry } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { lightTheme, darkTheme } from './theme';
import { message } from 'antd';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import LogManagement from './pages/LogManagement';
import AIChat from './pages/AIChat';
import DocumentGeneration from './pages/DocumentGeneration';
import KnowledgeBase from './pages/KnowledgeBase';
import SystemSettings from './pages/SystemSettings';
import CodeAudit from './pages/CodeAudit';

// 权限保护组件
const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) => {
  const { user, isAuthenticated, token } = useAuthStore();

  // 严格检查：必须同时满足 isAuthenticated 和 token 存在
  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user?.role !== 'ADMIN') {
    message.error('您没有权限访问此页面');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { isAuthenticated, updateActivity, logout } = useAuthStore();
  const { isDark } = useThemeStore();

  // 初始化时检查认证状态
  useEffect(() => {
    // 强制检查认证状态，如果未登录，清除任何可能残留的存储
    const { isAuthenticated: auth } = useAuthStore.getState();
    if (!auth) {
      useAuthStore.getState().logout();
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    // 监听用户活动
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      updateActivity();
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    // 每分钟检查一次会话是否过期
    const checkInterval = setInterval(() => {
      if (checkSessionExpiry()) {
        message.warning('10分钟无操作，已自动退出登录');
        logout();
        window.location.href = '/login';
      }
    }, 60000); // 每分钟检查一次

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearInterval(checkInterval);
    };
  }, [isAuthenticated, updateActivity, logout]);

  return (
    <ConfigProvider
      theme={isDark ? darkTheme : lightTheme}
      locale={zhCN}
    >
      <AntApp>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="ai-chat" element={<AIChat />} />
            <Route path="document-generation" element={<DocumentGeneration />} />
            <Route path="knowledge-base" element={<KnowledgeBase />} />
            <Route path="code-audit" element={<CodeAudit />} />
            <Route 
              path="users" 
              element={
                <ProtectedRoute requireAdmin>
                  <UserManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="logs" 
              element={
                <ProtectedRoute requireAdmin>
                  <LogManagement />
                </ProtectedRoute>
              } 
            />
            <Route path="settings" element={<SystemSettings />} />
          </Route>
        </Routes>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
