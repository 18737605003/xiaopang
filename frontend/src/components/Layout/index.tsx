import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Avatar, Dropdown, theme, Switch, Breadcrumb, Space, Badge, Tooltip } from 'antd';
import {
  DashboardOutlined,
  MessageOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  UserOutlined,
  FileSearchOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BulbOutlined,
  BellOutlined,
  SearchOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import './index.css';

const { Header, Sider, Content } = AntLayout;

const Layout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { token } = theme.useToken();

  const isAdmin = user?.role === 'ADMIN';

  // 更新 HTML 主题属性
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // 路由到面包屑映射
  const breadcrumbNameMap: Record<string, string> = {
    '/': '首页',
    '/ai-chat': 'AI对话',
    '/document-generation': '文档生成',
    '/knowledge-base': '知识库',
    '/code-audit': '代码审计',
    '/users': '用户管理',
    '/logs': '日志管理',
    '/settings': '系统设置',
  };

  // 生成面包屑
  const getBreadcrumbs = () => {
    const pathSnippets = location.pathname.split('/').filter(i => i);
    
    if (pathSnippets.length === 0) {
      return [{ title: <HomeOutlined />, path: '/' }];
    }

    const breadcrumbs = [
      { title: <HomeOutlined />, path: '/' },
    ];

    pathSnippets.forEach((_, index) => {
      const url = `/${pathSnippets.slice(0, index + 1).join('/')}`;
      const title = breadcrumbNameMap[url] || url;
      breadcrumbs.push({ title, path: url });
    });

    return breadcrumbs;
  };

  // 所有菜单项
  const allMenuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '首页', roles: ['ADMIN', 'USER'] },
    { key: '/ai-chat', icon: <MessageOutlined />, label: 'AI对话', roles: ['ADMIN', 'USER'] },
    { key: '/document-generation', icon: <FileTextOutlined />, label: '文档生成', roles: ['ADMIN', 'USER'] },
    { key: '/knowledge-base', icon: <DatabaseOutlined />, label: '知识库', roles: ['ADMIN', 'USER'] },
    { key: '/code-audit', icon: <FileSearchOutlined />, label: '代码审计', roles: ['ADMIN', 'USER'] },
    { key: '/users', icon: <UserOutlined />, label: '用户管理', roles: ['ADMIN'] },
    { key: '/logs', icon: <FileSearchOutlined />, label: '日志管理', roles: ['ADMIN'] },
    { key: '/settings', icon: <SettingOutlined />, label: '系统设置', roles: ['ADMIN', 'USER'] },
  ];

  // 根据用户角色过滤菜单
  const menuItems = allMenuItems.filter(item => 
    item.roles.includes(user?.role || '')
  );

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
        }}
      >
        <div className="logo">
          {collapsed ? (
            <span style={{ fontSize: '24px', fontWeight: 'bold' }}>AI</span>
          ) : (
            <>
              <span style={{ fontSize: '24px', marginRight: '8px' }}>🤖</span>
              <span style={{ fontSize: '18px', fontWeight: 600 }}>AI 企业平台</span>
            </>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout style={{ marginLeft: collapsed ? 80 : 240, transition: 'margin-left 0.2s', minHeight: '100vh' }}>
        <Header 
          style={{ 
            padding: 0, 
            background: token.colorBgContainer,
            position: 'sticky',
            top: 0,
            zIndex: 999,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div className="header-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                className="trigger"
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </div>
              
              <Breadcrumb
                items={getBreadcrumbs().map(item => ({
                  title: item.title,
                  onClick: () => navigate(item.path),
                  className: 'breadcrumb-item',
                }))}
              />
            </div>

            <Space size={20} align="center">
              {/* 全局搜索 */}
              <Tooltip title="全局搜索 (Ctrl+K)">
                <SearchOutlined 
                  style={{ fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onClick={() => console.log('打开搜索')}
                />
              </Tooltip>

              {/* 通知 */}
              <Tooltip title="通知">
                <Badge count={5} size="small">
                  <BellOutlined 
                    style={{ fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    onClick={() => console.log('打开通知')}
                  />
                </Badge>
              </Tooltip>

              {/* 主题切换 */}
              <Tooltip title={isDark ? '切换到浅色模式' : '切换到深色模式'}>
                <Switch
                  checked={isDark}
                  onChange={toggleTheme}
                  checkedChildren={<BulbOutlined />}
                  unCheckedChildren={<BulbOutlined />}
                  style={{ display: 'flex', alignItems: 'center' }}
                />
              </Tooltip>

              {/* 用户信息 */}
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <div className="user-info">
                  <Avatar 
                    src={user?.avatar} 
                    icon={<UserOutlined />}
                    size="small"
                    style={{ cursor: 'pointer' }}
                  />
                  <div className="user-text">
                    <span className="username">{user?.username}</span>
                    <span className="user-role">
                      {user?.role === 'ADMIN' ? '管理员' : '普通用户'}
                    </span>
                  </div>
                </div>
              </Dropdown>
            </Space>
          </div>
        </Header>
        <Content 
          className="site-layout-content"
          style={{
            padding: '24px',
            background: 'var(--bg-layout)',
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
