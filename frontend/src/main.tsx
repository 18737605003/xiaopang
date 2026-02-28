import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// 在应用启动前检查并清理无效的认证状态
const storedAuth = localStorage.getItem('auth-storage');
if (storedAuth) {
  try {
    const authData = JSON.parse(storedAuth);
    // 如果没有token，清除存储
    if (!authData.state?.token) {
      localStorage.removeItem('auth-storage');
    }
  } catch {
    localStorage.removeItem('auth-storage');
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
