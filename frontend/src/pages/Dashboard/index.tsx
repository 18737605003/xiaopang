import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, Progress, Tag, Space, Typography, Segmented, Spin, Empty } from 'antd';
import {
  UserOutlined,
  MessageOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DatabaseOutlined,
  ApiOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './index.css';

const { Title, Text } = Typography;

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
  const [timeRange, setTimeRange] = useState<string>('week');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // 获取Dashboard统计数据
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

  // 统计卡片数据（基于真实数据，添加点击跳转）
  const statCards = [
    {
      title: '总用户数',
      value: stats?.totalUsers || 0,
      prefix: <UserOutlined />,
      suffix: '人',
      trend: 0,
      color: '#0050b3',
      bgColor: 'rgba(0, 80, 179, 0.1)',
      show: stats && stats.totalUsers > 0,
      path: '/users',
    },
    {
      title: '文档总数',
      value: stats?.totalDocuments || 0,
      prefix: <DatabaseOutlined />,
      suffix: '个',
      trend: 0,
      color: '#fa8c16',
      bgColor: 'rgba(250, 140, 22, 0.1)',
      show: stats && stats.totalDocuments > 0,
      path: '/knowledge-base',
    },
    {
      title: '今日调用',
      value: stats?.todayApiCalls || 0,
      prefix: <ApiOutlined />,
      suffix: '次',
      trend: 0,
      color: '#13c2c2',
      bgColor: 'rgba(19, 194, 194, 0.1)',
      show: stats && stats.todayApiCalls > 0,
      path: '/logs',
    },
    {
      title: '平均响应',
      value: stats?.avgResponseTime || 0,
      prefix: <ClockCircleOutlined />,
      suffix: 's',
      trend: 0,
      color: '#52c41a',
      bgColor: 'rgba(82, 196, 26, 0.1)',
      show: stats && stats.avgResponseTime > 0,
      path: null,
    },
  ].filter(card => card.show);

  // 功能使用分布数据
  const featureData = [
    { name: 'AI对话', count: stats?.featureUsage?.aiChat || 0, color: '#0050b3' },
    { name: '文档分析', count: stats?.featureUsage?.documentGen || 0, color: '#13c2c2' },
    { name: '知识库', count: stats?.featureUsage?.knowledgeBase || 0, color: '#fa8c16' },
    { name: '代码审计', count: stats?.featureUsage?.codeAudit || 0, color: '#52c41a' },
  ].filter(item => item.count > 0);

  const COLORS = ['#0050b3', '#13c2c2', '#fa8c16', '#52c41a'];

  // API调用趋势数据
  const usageData = stats?.apiTrend?.length ? stats.apiTrend : [];

  // 是否有统计数据
  const hasAnyStats = statCards.length > 0 || featureData.length > 0 || usageData.length > 0;

  if (loading) {
    return (
      <div className="dashboard-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <Spin size="large" tip="加载统计数据中..." />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <Title level={2} style={{ margin: 0 }}>数据概览</Title>
          <Text type="secondary">实时监控系统运行状态和关键指标</Text>
        </div>
        {hasAnyStats && (
          <Segmented
            value={timeRange}
            onChange={setTimeRange}
            options={[
              { label: '今日', value: 'today' },
              { label: '本周', value: 'week' },
              { label: '本月', value: 'month' },
            ]}
          />
        )}
      </div>

      {!hasAnyStats ? (
        <Card style={{ marginTop: 24 }}>
          <Empty
            description="暂无统计数据"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Text type="secondary">
              系统刚初始化，还没有产生任何数据。开始使用平台功能后，统计数据将自动显示在这里。
            </Text>
          </Empty>
        </Card>
      ) : (
        <>
          {/* 统计卡片 - 支持点击跳转 */}
          {statCards.length > 0 && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {statCards.map((stat, index) => (
                <Col xs={24} sm={12} lg={6} key={index}>
                  <Card 
                    className={`stat-card hover-card ${stat.path ? 'clickable-card' : ''}`}
                    style={{ 
                      borderLeft: `4px solid ${stat.color}`,
                      background: stat.bgColor,
                      cursor: stat.path ? 'pointer' : 'default',
                    }}
                    onClick={() => stat.path && navigate(stat.path)}
                    hoverable={!!stat.path}
                  >
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 14 }}>{stat.title}</Text>
                        <div style={{ 
                          fontSize: 24, 
                          color: stat.color,
                          background: 'rgba(255, 255, 255, 0.8)',
                          padding: '8px',
                          borderRadius: '8px',
                        }}>
                          {stat.prefix}
                        </div>
                      </div>
                      <div>
                        <Statistic
                          value={stat.value}
                          suffix={stat.suffix}
                          valueStyle={{ 
                            fontSize: 32,
                            fontWeight: 600,
                            color: stat.color,
                          }}
                        />
                      </div>
                      {stat.path && (
                        <Text type="secondary" style={{ fontSize: 12, color: stat.color }}>
                          点击查看详情 →
                        </Text>
                      )}
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          <Row gutter={[16, 16]}>
            {/* API调用趋势 */}
            {usageData.length > 0 && (
              <Col xs={24} lg={16}>
                <Card 
                  title={
                    <Space>
                      <ApiOutlined />
                      <span>API 调用趋势</span>
                    </Space>
                  }
                  extra={
                    <Space>
                      <Tag color="success">成功</Tag>
                      <Tag color="error">失败</Tag>
                    </Space>
                  }
                  className="chart-card"
                >
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={usageData}>
                      <defs>
                        <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#52c41a" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#52c41a" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f5222d" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f5222d" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" stroke="#8c8c8c" />
                      <YAxis stroke="#8c8c8c" />
                      <Tooltip />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="success" 
                        stroke="#52c41a" 
                        fillOpacity={1}
                        fill="url(#colorSuccess)"
                        name="成功"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="failed" 
                        stroke="#f5222d" 
                        fillOpacity={1}
                        fill="url(#colorFailed)"
                        name="失败"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            )}

            {/* 功能使用分布 */}
            {featureData.length > 0 && (
              <Col xs={24} lg={usageData.length > 0 ? 8 : 16}>
                <Card 
                  title={
                    <Space>
                      <DatabaseOutlined />
                      <span>功能使用分布</span>
                    </Space>
                  }
                  className="chart-card"
                >
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={featureData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {featureData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            )}
          </Row>
        </>
      )}
    </div>
  );
};

export default Dashboard;
