import { useState, useEffect } from 'react';
import { 
  Table, Card, DatePicker, Input, Select, Space, Button, Tabs, Tag, 
  Statistic, Row, Col, message, Modal, Tooltip, TableColumnsType
} from 'antd';
import { 
  SearchOutlined, DownloadOutlined, 
  ExclamationCircleOutlined, InfoCircleOutlined, WarningOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { 
  logsApi, 
  OperationLog, 
  SystemLog, 
  OperationLogStatistics,
  SystemLogStatistics,
  LogOptions
} from '../../api/logs';

const { RangePicker } = DatePicker;

type LogTabKey = 'operation' | 'system';

const LogManagement = () => {
  const [activeTab, setActiveTab] = useState<LogTabKey>('operation');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<LogOptions | null>(null);
  
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  
  const [operationStats, setOperationStats] = useState<OperationLogStatistics | null>(null);
  const [systemStats, setSystemStats] = useState<SystemLogStatistics | null>(null);
  
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  
  const [filters, setFilters] = useState<any>({
    startDate: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
  });

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [activeTab, filters, pagination.current, pagination.pageSize]);

  const loadOptions = async () => {
    try {
      const data = await logsApi.getLogOptions();
      setOptions(data);
    } catch (error) {
      console.error('加载选项失败:', error);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      };

      switch (activeTab) {
        case 'operation': {
          const res = await logsApi.getOperationLogs(params);
          setOperationLogs(res.data);
          setPagination(prev => ({ ...prev, total: res.total }));
          const stats = await logsApi.getOperationLogStatistics();
          setOperationStats(stats);
          break;
        }
        case 'system': {
          const res = await logsApi.getSystemLogs(params);
          setSystemLogs(res.data);
          setPagination(prev => ({ ...prev, total: res.total }));
          const stats = await logsApi.getSystemLogStatistics();
          setSystemStats(stats);
          break;
        }
      }
    } catch (error) {
      message.error('加载日志失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    loadLogs();
  };

  const handleExport = async () => {
    try {
      const res = await logsApi.exportLogs({ type: activeTab, ...filters });
      const csvContent = [
        res.headers.join(','),
        ...res.data.map((row: any) => Object.values(row).join(','))
      ].join('\n');
      
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${activeTab}_logs_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
      link.click();
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleClearLogs = () => {
    const logTypeName = activeTab === 'operation' ? '操作日志' : '系统日志';
    const dateRange = filters.startDate && filters.endDate 
      ? `${filters.startDate} 至 ${filters.endDate}` 
      : '所有';
    
    Modal.confirm({
      title: '确认清除日志',
      icon: <ExclamationCircleOutlined />,
      content: `确定要清除${dateRange}的${logTypeName}吗？此操作不可恢复！`,
      okText: '确认清除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const clearFn = activeTab === 'operation' 
            ? logsApi.clearOperationLogs 
            : logsApi.clearSystemLogs;
          
          const res = await clearFn(filters);
          message.success(res.message);
          loadLogs();
        } catch (error: any) {
          message.error(error.response?.data?.message || '清除日志失败');
        }
      },
    });
  };

  const handleSecurityEvent = async (id: string) => {
    Modal.confirm({
      title: '确认处理',
      icon: <ExclamationCircleOutlined />,
      content: '确定要将此安全事件标记为已处理吗？',
      onOk: async () => {
        try {
          await logsApi.handleSecurityLog(id);
          message.success('已标记为已处理');
          loadLogs();
        } catch (error) {
          message.error('操作失败');
        }
      },
    });
  };

  const getStatusTag = (status: string) => {
    return status === 'SUCCESS' 
      ? <Tag color="success">成功</Tag> 
      : <Tag color="error">失败</Tag>;
  };

  const getLevelTag = (level: string) => {
    const colors: Record<string, string> = {
      INFO: 'processing',
      WARN: 'warning',
      ERROR: 'error',
    };
    const icons: Record<string, any> = {
      INFO: <InfoCircleOutlined />,
      WARN: <WarningOutlined />,
      ERROR: <ExclamationCircleOutlined />,
    };
    return <Tag color={colors[level]} icon={icons[level]}>{level}</Tag>;
  };

  const getSeverityTag = (severity: string) => {
    const colors: Record<string, string> = {
      LOW: 'default',
      MEDIUM: 'warning',
      HIGH: 'orange',
      CRITICAL: 'error',
    };
    return <Tag color={colors[severity]}>{severity}</Tag>;
  };

  const operationColumns: TableColumnsType<OperationLog> = [
    { 
      title: '时间', 
      dataIndex: 'createdAt', 
      key: 'createdAt', 
      width: 170,
      render: (date: string) => dayjs(date).format('MM-DD HH:mm:ss'),
    },
    { title: '用户', dataIndex: 'username', key: 'username', width: 100 },
    { 
      title: '操作描述', 
      key: 'description', 
      width: 200,
      render: (_, record) => {
        // 尝试从 details 中提取描述
        let description = '';
        try {
          if (record.details) {
            const details = typeof record.details === 'string' 
              ? JSON.parse(record.details) 
              : record.details;
            description = details.description || '';
          }
        } catch (e) {
          // 解析失败，使用默认描述
        }
        
        // 如果没有详细描述，使用默认组合
        if (!description) {
          const actionText = record.actionLabel || record.action;
          const resourceText = record.resourceLabel || record.resource;
          description = `${actionText}${resourceText}`;
        }
        
        return (
          <Tooltip title={`${record.action} ${record.resource}`}>
            <Tag color="blue">{description}</Tag>
          </Tooltip>
        );
      },
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      width: 70,
      render: (status: string) => getStatusTag(status),
    },
    { title: 'IP地址', dataIndex: 'ip', key: 'ip', width: 130 },
    { title: '耗时(ms)', dataIndex: 'duration', key: 'duration', width: 90 },
  ];

  const systemColumns: TableColumnsType<SystemLog> = [
    { 
      title: '时间', 
      dataIndex: 'createdAt', 
      key: 'createdAt', 
      width: 170,
      render: (date: string) => dayjs(date).format('MM-DD HH:mm:ss'),
    },
    { 
      title: '级别', 
      dataIndex: 'level', 
      key: 'level', 
      width: 80,
      render: (level: string) => getLevelTag(level),
    },
    { title: '模块', dataIndex: 'module', key: 'module', width: 100 },
    { title: '消息', dataIndex: 'message', key: 'message' },
    { 
      title: '堆栈', 
      dataIndex: 'stack', 
      key: 'stack', 
      width: 100,
      ellipsis: true,
      render: (stack: string) => stack ? (
        <Tooltip title={stack}>
          <span style={{ color: '#999' }}>查看</span>
        </Tooltip>
      ) : '-',
    },
  ];

  const securityColumns: TableColumnsType<SecurityLog> = [
    { 
      title: '时间', 
      dataIndex: 'createdAt', 
      key: 'createdAt', 
      width: 170,
      render: (date: string) => dayjs(date).format('MM-DD HH:mm:ss'),
    },
    { 
      title: '事件类型', 
      dataIndex: 'eventTypeLabel', 
      key: 'eventType', 
      width: 120,
    },
    { 
      title: '严重程度', 
      dataIndex: 'severity', 
      key: 'severity', 
      width: 90,
      render: (severity: string) => getSeverityTag(severity),
    },
    { title: '用户', dataIndex: 'username', key: 'username', width: 100 },
    { title: 'IP地址', dataIndex: 'ip', key: 'ip', width: 130 },
    { 
      title: '状态', 
      dataIndex: 'handled', 
      key: 'handled', 
      width: 100,
      render: (handled: boolean) => handled ? (
        <Tag color="success">已处理</Tag>
      ) : (
        <Tag color="warning">待处理</Tag>
      ),
    },
    { 
      title: '操作', 
      key: 'action', 
      width: 80,
      render: (_, record) => !record.handled ? (
        <Button type="link" size="small" onClick={() => handleSecurityEvent(record.id)}>
          处理
        </Button>
      ) : null,
    },
  ];

  const aiUsageColumns: TableColumnsType<AIUsageLog> = [
    { 
      title: '时间', 
      dataIndex: 'createdAt', 
      key: 'createdAt', 
      width: 170,
      render: (date: string) => dayjs(date).format('MM-DD HH:mm:ss'),
    },
    { title: '用户', dataIndex: 'username', key: 'username', width: 100 },
    { title: '模型', dataIndex: 'model', key: 'model', width: 180 },
    { title: '操作', dataIndex: 'action', key: 'action', width: 80 },
    { 
      title: 'Token数', 
      dataIndex: 'totalTokens', 
      key: 'totalTokens', 
      width: 100,
      render: (tokens: number) => tokens?.toLocaleString() || '-',
    },
    { 
      title: '费用($)', 
      dataIndex: 'cost', 
      key: 'cost', 
      width: 90,
      render: (cost: number) => cost?.toFixed(4) || '-',
    },
    { title: '耗时(ms)', dataIndex: 'duration', key: 'duration', width: 100 },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      width: 70,
      render: (status: string) => getStatusTag(status),
    },
  ];

  const renderFilters = () => {
    switch (activeTab) {
      case 'operation':
        return (
          <>
            <Select
              placeholder="用户"
              allowClear
              style={{ width: 120 }}
              options={options?.users.map(u => ({ label: u.username, value: u.id }))}
              value={filters.userId}
              onChange={userId => setFilters({ ...filters, userId })}
            />
          </>
        );
      case 'system':
        return (
          <>
            <Select
              placeholder="日志级别"
              allowClear
              style={{ width: 100 }}
              options={options?.levels}
              value={filters.level}
              onChange={level => setFilters({ ...filters, level })}
            />
            <Input
              placeholder="搜索消息"
              style={{ width: 200 }}
              value={filters.keyword}
              onChange={e => setFilters({ ...filters, keyword: e.target.value })}
            />
          </>
        );
      case 'security':
        return (
          <>
            <Select
              placeholder="事件类型"
              allowClear
              style={{ width: 130 }}
              options={options?.eventTypes}
              value={filters.eventType}
              onChange={eventType => setFilters({ ...filters, eventType })}
            />
            <Select
              placeholder="严重程度"
              allowClear
              style={{ width: 100 }}
              options={options?.severities}
              value={filters.severity}
              onChange={severity => setFilters({ ...filters, severity })}
            />
            <Select
              placeholder="处理状态"
              allowClear
              style={{ width: 100 }}
              options={[
                { label: '待处理', value: 'false' },
                { label: '已处理', value: 'true' },
              ]}
              value={filters.handled}
              onChange={handled => setFilters({ ...filters, handled })}
            />
          </>
        );
      case 'ai-usage':
        return (
          <>
            <Select
              placeholder="用户"
              allowClear
              style={{ width: 120 }}
              options={options?.users.map(u => ({ label: u.username, value: u.id }))}
              value={filters.userId}
              onChange={userId => setFilters({ ...filters, userId })}
            />
            <Select
              placeholder="模型"
              allowClear
              style={{ width: 180 }}
              options={options?.models.map(m => ({ label: m, value: m }))}
              value={filters.model}
              onChange={model => setFilters({ ...filters, model })}
            />
            <Select
              placeholder="状态"
              allowClear
              style={{ width: 100 }}
              options={[
                { label: '成功', value: 'SUCCESS' },
                { label: '失败', value: 'FAILURE' },
              ]}
              value={filters.status}
              onChange={status => setFilters({ ...filters, status })}
            />
          </>
        );
    }
  };

  const renderStats = () => {
    switch (activeTab) {
      case 'operation':
        return operationStats && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={4}>
              <Statistic title="今日操作" value={operationStats.todayLogs} />
            </Col>
            <Col span={4}>
              <Statistic title="总操作数" value={operationStats.totalLogs} />
            </Col>
            <Col span={4}>
              <Statistic title="成功率" value={operationStats.successRate} suffix="%" />
            </Col>
            <Col span={4}>
              <Statistic title="成功" value={operationStats.successLogs} valueStyle={{ color: '#3f8600' }} />
            </Col>
            <Col span={4}>
              <Statistic title="失败" value={operationStats.failureLogs} valueStyle={{ color: '#cf1322' }} />
            </Col>
          </Row>
        );
      case 'system':
        return systemStats && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={4}>
              <Statistic title="总日志数" value={systemStats.totalLogs} />
            </Col>
            <Col span={4}>
              <Statistic title="信息" value={systemStats.infoLogs} valueStyle={{ color: '#1890ff' }} />
            </Col>
            <Col span={4}>
              <Statistic title="警告" value={systemStats.warnLogs} valueStyle={{ color: '#faad14' }} />
            </Col>
            <Col span={4}>
              <Statistic title="错误" value={systemStats.errorLogs} valueStyle={{ color: '#cf1322' }} />
            </Col>
          </Row>
        );
      case 'security':
        return securityStats && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={4}>
              <Statistic title="总事件数" value={securityStats.totalLogs} />
            </Col>
            <Col span={4}>
              <Statistic 
                title="待处理" 
                value={securityStats.unhandledLogs} 
                valueStyle={{ color: securityStats.unhandledLogs > 0 ? '#cf1322' : '#3f8600' }} 
              />
            </Col>
            <Col span={4}>
              <Statistic 
                title="严重事件" 
                value={securityStats.criticalLogs} 
                valueStyle={{ color: securityStats.criticalLogs > 0 ? '#cf1322' : undefined }} 
              />
            </Col>
          </Row>
        );
      case 'ai-usage':
        return aiUsageStats && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={4}>
              <Statistic title="今日调用" value={aiUsageStats.todayCalls} />
            </Col>
            <Col span={4}>
              <Statistic title="总调用数" value={aiUsageStats.totalCalls} />
            </Col>
            <Col span={4}>
              <Statistic title="总Token数" value={aiUsageStats.totalTokens.toLocaleString()} />
            </Col>
            <Col span={4}>
              <Statistic title="总费用" value={aiUsageStats.totalCost.toFixed(2)} prefix="$" />
            </Col>
            <Col span={4}>
              <Statistic title="成功率" value={aiUsageStats.successRate} suffix="%" />
            </Col>
          </Row>
        );
    }
  };

  const getDataSource = () => {
    switch (activeTab) {
      case 'operation': return operationLogs;
      case 'system': return systemLogs;
    }
  };

  const getColumns = (): TableColumnsType<any> => {
    switch (activeTab) {
      case 'operation': return operationColumns;
      case 'system': return systemColumns;
    }
  };

  const tabItems = [
    { key: 'operation', label: '操作日志' },
    { key: 'system', label: '系统日志' },
  ];

  return (
    <div>
      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={(key) => {
            setActiveTab(key as LogTabKey);
            setFilters({ 
              startDate: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
              endDate: dayjs().format('YYYY-MM-DD'),
            });
            setPagination(prev => ({ ...prev, current: 1 }));
          }}
          items={tabItems}
        />
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Space wrap style={{ marginBottom: 16 }}>
          <RangePicker
            value={[
              filters.startDate ? dayjs(filters.startDate) : null,
              filters.endDate ? dayjs(filters.endDate) : null,
            ]}
            onChange={(_, dateStrings) => setFilters({ 
              ...filters, 
              startDate: dateStrings[0], 
              endDate: dateStrings[1] 
            })}
          />
          {renderFilters()}
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            查询
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
          <Button danger icon={<DeleteOutlined />} onClick={handleClearLogs}>
            清除日志
          </Button>
        </Space>

        {renderStats()}

        <Table
          columns={getColumns()}
          dataSource={getDataSource()}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
};

export default LogManagement;