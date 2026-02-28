import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Avatar, Dropdown, theme, Switch, Breadcrumb, Space, Badge, Tooltip, message } from 'antd';
import type { MenuProps } from 'antd';
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
  AuditOutlined,
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

  // 更新 HTML 主题属性
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // 路由到面包屑映射
  const breadcrumbNameMap: Record<string, string> = {
    '/': '首页',
    '/ai-chat': 'AI 对话',
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

  // 菜单项 - 分组
  const coreMenuItems: MenuProps['items'] = [
    {
      key: 'core-group',
      type: 'group',
      label: collapsed ? null : '核心功能',
      children: [
        { key: '/', icon: <DashboardOutlined />, label: '工作台' },
        { key: '/ai-chat', icon: <MessageOutlined />, label: 'AI 对话' },
        { key: '/document-generation', icon: <FileTextOutlined />, label: '文档生成' },
        { key: '/knowledge-base', icon: <DatabaseOutlined />, label: '知识库' },
        { key: '/code-audit', icon: <AuditOutlined />, label: '代码审计' },
      ],
    },
  ];

  const adminMenuItems: MenuProps['items'] = user?.role === 'ADMIN' ? [
    {
      key: 'admin-group',
      type: 'group',
      label: collapsed ? null : '系统管理',
      children: [
        { key: '/users', icon: <UserOutlined />, label: '用户管理' },
        { key: '/logs', icon: <FileSearchOutlined />, label: '日志管理' },
        { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
      ],
    },
  ] : [
    {
      key: 'settings-group',
      type: 'group',
      label: collapsed ? null : '设置',
      children: [
        { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
      ],
    },
  ];

  const menuItems: MenuProps['items'] = [
    ...(coreMenuItems || []),
    ...(adminMenuItems || []),
  ];

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
        width={224}
        collapsedWidth={64}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          {collapsed ? (
            <span className="logo-text-collapsed">AI</span>
          ) : (
            <div className="logo-inner">
              <div className="logo-icon">AI</div>
              <span className="logo-text">AI Enterprise</span>
            </div>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <AntLayout style={{ marginLeft: collapsed ? 64 : 224, transition: 'margin-left 0.2s ease', minHeight: '100vh' }}>
        <Header 
          style={{ 
            padding: 0, 
            background: token.colorBgContainer,
            position: 'sticky',
            top: 0,
            zIndex: 999,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            height: 56,
            lineHeight: '56px',
          }}
        >
          <div className="header-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

            <Space size={4} align="center">
              {/* 全局搜索 */}
              <Tooltip title="全局搜索">
                <div className="header-icon-btn" onClick={() => message.info('搜索功能开发中')}>
                  <SearchOutlined />
                </div>
              </Tooltip>

              {/* 通知 */}
              <Tooltip title="通知">
                <div className="header-icon-btn" onClick={() => message.info('通知功能开发中')}>
                  <Badge count={0} size="small">
                    <BellOutlined style={{ fontSize: '16px' }} />
                  </Badge>
                </div>
              </Tooltip>

              {/* 主题切换 */}
              <Tooltip title={isDark ? '切换到浅色模式' : '切换到深色模式'}>
                <div className="header-icon-btn" onClick={toggleTheme}>
                  <BulbOutlined />
                </div>
              </Tooltip>

              <div className="header-divider" />

              {/* 用户信息 */}
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <div className="user-info">
                  <Avatar 
                    src={user?.avatar} 
                    icon={<UserOutlined />}
                    size={28}
                    style={{ 
                      cursor: 'pointer',
                      backgroundColor: token.colorPrimary,
                    }}
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
          className="site-layout-content page-enter-animation"
          key={location.pathname}
          style={{
            padding: 'var(--page-padding)',
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
