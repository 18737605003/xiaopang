import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, Tag, Space, Typography, Segmented, Skeleton, Empty } from 'antd';
import {
  UserOutlined,
  MessageOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  ApiOutlined,
  AuditOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuthStore } from '../../store/authStore';
import PageHeader from '../../components/PageHeader';
import './index.css';

const { Text } = Typography;

interface DashboardStats {
  totalUsers: number;
  totalDocuments: number;
  todayApiCalls: number;
  avgResponseTime: number;
  featureUsage: {
    aiChat: number;
    documentGen: number;
    knowledgeBase: number;
    codeAudit: number;
  };
  apiTrend: Array<{ date: string; calls: number; success: number; failed: number }>;
  lastUpdated: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [timeRange, setTimeRange] = useState<string>('week');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // 时间问候语
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '上午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/dashboard/stats');
        const result = await response.json();
        if (result.success && result.data) {
          setStats(result.data);
        }
      } catch (error) {
        console.error('获取统计数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // 快捷操作
  const quickActions = [
    { icon: <MessageOutlined />, label: 'AI 对话', path: '/ai-chat', color: '#1677ff' },
    { icon: <FileTextOutlined />, label: '文档生成', path: '/document-generation', color: '#52c41a' },
    { icon: <DatabaseOutlined />, label: '知识库', path: '/knowledge-base', color: '#faad14' },
    { icon: <AuditOutlined />, label: '代码审计', path: '/code-audit', color: '#ff4d4f' },
  ];

  // 统计卡片
  const statCards = [
    { title: '总用户数', value: stats?.totalUsers || 0, suffix: '人', icon: <UserOutlined />, color: '#1677ff' },
    { title: '文档总数', value: stats?.totalDocuments || 0, suffix: '个', icon: <DatabaseOutlined />, color: '#52c41a' },
    { title: '今日调用', value: stats?.todayApiCalls || 0, suffix: '次', icon: <ApiOutlined />, color: '#faad14' },
    { title: '平均响应', value: stats?.avgResponseTime || 0, suffix: 's', icon: <ClockCircleOutlined />, color: '#ff4d4f' },
  ];

  // 功能使用分布
  const featureData = [
    { name: 'AI 对话', count: stats?.featureUsage?.aiChat || 0, color: '#1677ff' },
    { name: '文档分析', count: stats?.featureUsage?.documentGen || 0, color: '#52c41a' },
    { name: '知识库', count: stats?.featureUsage?.knowledgeBase || 0, color: '#faad14' },
    { name: '代码审计', count: stats?.featureUsage?.codeAudit || 0, color: '#ff4d4f' },
  ].filter(item => item.count > 0);

  const usageData = stats?.apiTrend?.length ? stats.apiTrend : [];
  const hasChartData = featureData.length > 0 || usageData.length > 0;

  return (
    <div className="dashboard-container">
      <PageHeader
        title={`${getGreeting()}，${user?.username || '用户'}`}
        description="欢迎使用 AI 企业工作平台，以下是系统运行概览"
        extra={
          hasChartData ? (
            <Segmented
              value={timeRange}
              onChange={setTimeRange}
              options={[
                { label: '今日', value: 'today' },
                { label: '本周', value: 'week' },
                { label: '本月', value: 'month' },
              ]}
            />
          ) : null
        }
      />

      {/* 快捷操作 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {quickActions.map((action) => (
          <Col xs={12} sm={6} key={action.path}>
            <div
              className="quick-action-item"
              onClick={() => navigate(action.path)}
            >
              <div className="quick-action-icon" style={{ background: `${action.color}10`, color: action.color }}>
                {action.icon}
              </div>
              <span className="quick-action-label">{action.label}</span>
              <RightOutlined className="quick-action-arrow" />
            </div>
          </Col>
        ))}
      </Row>

      {/* 统计卡片 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Col xs={12} sm={6} key={i}>
                <Card className="stat-card" bodyStyle={{ padding: 16 }}>
                  <Skeleton active paragraph={{ rows: 1 }} title={{ width: 80 }} />
                </Card>
              </Col>
            ))
          : statCards.map((stat, index) => (
              <Col xs={12} sm={6} key={index}>
                <Card className="stat-card" bodyStyle={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <Text style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{stat.title}</Text>
                      <Statistic
                        value={stat.value}
                        suffix={<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>{stat.suffix}</span>}
                        valueStyle={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: '36px' }}
                      />
                    </div>
                    <div className="stat-icon-wrapper" style={{ background: `${stat.color}10`, color: stat.color }}>
                      {stat.icon}
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
      </Row>

      {/* 图表区域 */}
      {loading ? (
        <Row gutter={[12, 12]}>
          <Col xs={24} lg={16}><Card><Skeleton active paragraph={{ rows: 8 }} /></Card></Col>
          <Col xs={24} lg={8}><Card><Skeleton active paragraph={{ rows: 8 }} /></Card></Col>
        </Row>
      ) : !hasChartData ? (
        <Card>
          <Empty
            description="暂无统计数据"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Text type="secondary">
              开始使用平台功能后，统计数据将自动显示在这里
            </Text>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[12, 12]}>
          {usageData.length > 0 && (
            <Col xs={24} lg={16}>
              <Card
                title="API 调用趋势"
                extra={<Space><Tag color="success">成功</Tag><Tag color="error">失败</Tag></Space>}
                className="chart-card"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={usageData}>
                    <defs>
                      <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#52c41a" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#52c41a" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff4d4f" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#ff4d4f" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color-light)" />
                    <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="success" stroke="#52c41a" fillOpacity={1} fill="url(#colorSuccess)" name="成功" strokeWidth={2} />
                    <Area type="monotone" dataKey="failed" stroke="#ff4d4f" fillOpacity={1} fill="url(#colorFailed)" name="失败" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          )}
          {featureData.length > 0 && (
            <Col xs={24} lg={usageData.length > 0 ? 8 : 16}>
              <Card title="功能使用分布" className="chart-card">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={featureData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={90}
                      innerRadius={50}
                      fill="#8884d8"
                      dataKey="count"
                      strokeWidth={0}
                    >
                      {featureData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          )}
        </Row>
      )}
    </div>
  );
};

export default Dashboard;
