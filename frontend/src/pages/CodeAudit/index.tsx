import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Modal, Progress, List, Tag, Space, Statistic, Typography, Tabs, Select, Spin } from 'antd';
import { GithubOutlined, RocketOutlined, FileTextOutlined, BugOutlined, CheckCircleOutlined, BranchesOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { auditApi, type Issue } from '../../api/audit';
import ReactMarkdown from 'react-markdown';

const { Text, Paragraph, Title } = Typography;
const { Option } = Select;

const CodeAudit = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    loadTasks();
  }, []);
  
  const loadTasks = async () => {
    try {
      const response: any = await auditApi.getTasks({ page: 1, pageSize: 10 });
      setTasks(response.data);
    } catch (error) {
      console.error('加载任务列表失败:', error);
    }
  };
  const handleRepoUrlChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const repoUrl = e.target.value.trim();

    // 清空分支列表
    setBranches([]);
    form.setFieldValue('branch', '');

    // 如果 URL 为空或无效，不请求
    if (!repoUrl) {
      return;
    }

    // 简单验证 URL 格式
    const isValidFormat = /^(https?:\/\/.+\/.+\/.+|git@.+:.+\/.+\.git|ssh:\/\/.+\/.+\/.+)$/.test(repoUrl);
    if (!isValidFormat) {
      return;
    }

    // 获取分支列表
    setBranchesLoading(true);
    try {
      console.log('🌿 正在获取分支列表...');
      const response = await auditApi.getBranches(repoUrl);
      setBranches(response.branches);

      // 自动选择默认分支
      if (response.defaultBranch) {
        form.setFieldValue('branch', response.defaultBranch);
      }

      message.success(`找到 ${response.branches.length} 个分支`);
    } catch (error: any) {
      console.error('获取分支失败:', error);
      message.warning('无法获取分支列表，请手动输入分支名称');
    } finally {
      setBranchesLoading(false);
    }
  };

  
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const response: any = await auditApi.submit(values);
      message.success('审计任务已创建');
      form.resetFields();
      
      // 显示进度对话框
      showProgressModal(response.taskId);
      
      // 刷新任务列表
      loadTasks();
    } catch (error: any) {
      message.error(error.response?.data?.message || '提交失败');
    } finally {
      setLoading(false);
    }
  };
  
  const showProgressModal = (taskId: string) => {
    let progressModal: any = null;
    let eventSource: EventSource | null = null;
    let liveOutput = '';
    
    const closeModal = () => {
      if (eventSource) {
        eventSource.close();
      }
      if (progressModal) {
        progressModal.destroy();
      }
    };
    
    progressModal = Modal.info({
      title: '代码审计进度',
      content: (
        <div>
          <Progress percent={0} status="active" />
          <div style={{ marginTop: 8, color: '#666' }}>准备开始...</div>
        </div>
      ),
      okText: '后台运行',
      onOk: closeModal,
      width: 1200,
      style: { top: 20 },
    });
    
    // 连接 SSE
    eventSource = new EventSource(`http://localhost:3000/api/audit/progress/${taskId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data);
        const percent = progress.progress || 0;
        
        // 更新实时输出
        if (progress.liveOutput) {
          liveOutput = progress.liveOutput;
        }
        
        progressModal.update({
          content: (
            <div>
              <Progress 
                percent={percent} 
                status={progress.status === 'failed' ? 'exception' : progress.status === 'completed' ? 'success' : 'active'}
              />
              <div style={{ marginTop: 8, color: '#666' }}>{progress.message || '处理中...'}</div>
              
              {liveOutput && (
                <div style={{ marginTop: 16 }}>
                  <Text strong style={{ fontSize: 16 }}>🔍 AI 分析结果</Text>
                  <div style={{ 
                    marginTop: 12, 
                    maxHeight: 600, 
                    overflow: 'auto',
                    background: '#fff',
                    padding: 20,
                    borderRadius: 8,
                    border: '1px solid #e8e8e8',
                    fontSize: 14,
                    lineHeight: 1.8,
                  }}>
                    <ReactMarkdown>{liveOutput}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ),
        });
        
        if (progress.status === 'completed') {
          message.success('代码审计完成！');
          closeModal();
          loadTasks();
          // 自动打开报告
          handleViewReport(taskId);
        } else if (progress.status === 'failed') {
          message.error('代码审计失败');
          closeModal();
          loadTasks();
        }
      } catch (error) {
        console.error('解析进度数据失败:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE 连接错误:', error);
      eventSource?.close();
    };
  };
  
  const handleViewReport = async (taskId: string) => {
    try {
      const report = await auditApi.getReport(taskId);
      setSelectedTask(report);
      setReportVisible(true);
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取报告失败');
    }
  };
  
  const handleDeleteTask = async (taskId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个审计任务吗？',
      onOk: async () => {
        try {
          await auditApi.deleteTask(taskId);
          message.success('删除成功');
          loadTasks();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };
  
  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'red',
      high: 'orange',
      medium: 'gold',
      low: 'green',
    };
    return colors[severity] || 'default';
  };
  
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: '等待中' },
      cloning: { color: 'processing', text: '克隆中' },
      analyzing: { color: 'processing', text: '分析中' },
      completed: { color: 'success', text: '已完成' },
      failed: { color: 'error', text: '失败' },
    };
    const info = statusMap[status] || { color: 'default', text: status };
    return <Tag color={info.color}>{info.text}</Tag>;
  };
  
  return (
    <div>
      <Title level={2}>代码安全审计</Title>
      
      <Card title="提交审计任务" style={{ marginBottom: 16 }}>
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            label="Git 仓库 URL"
            name="repoUrl"
            rules={[
              { required: true, message: '请输入仓库 URL' },
            ]}
            tooltip="支持 GitHub、GitLab、Gitea、Bitbucket 及自建 Git 服务"
          >
            <Input
              prefix={<GithubOutlined />}
              placeholder="https://github.com/user/repo 或 git@github.com:user/repo.git"
              size="large"
              onChange={handleRepoUrlChange}
            />
          </Form.Item>
          
          <Form.Item 
            label="分支" 
            name="branch"
            rules={[{ required: true, message: '请选择或输入分支' }]}
            tooltip="输入 Git URL 后自动获取分支列表"
          >
            {branches.length > 0 ? (
              <Select
                placeholder="选择分支"
                size="large"
                loading={branchesLoading}
                suffixIcon={branchesLoading ? <Spin size="small" /> : <BranchesOutlined />}
                showSearch
                optionFilterProp="children"
              >
                {branches.map(branch => (
                  <Option key={branch} value={branch}>
                    <Space>
                      <BranchesOutlined />
                      {branch}
                    </Space>
                  </Option>
                ))}
              </Select>
            ) : (
              <Input 
                placeholder={branchesLoading ? "正在获取分支..." : "main"} 
                size="large"
                prefix={<BranchesOutlined />}
                disabled={branchesLoading}
              />
            )}
          </Form.Item>
          
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading} 
              size="large" 
              icon={<RocketOutlined />}
              block
            >
              开始审计
            </Button>
          </Form.Item>
        </Form>
      </Card>
      
      <Card title="审计历史">
        <List
          dataSource={tasks}
          locale={{ emptyText: '暂无审计记录' }}
          renderItem={(task: any) => (
            <List.Item
              actions={[
                task.status === 'completed' && (
                  <Button 
                    type="link" 
                    icon={<FileTextOutlined />}
                    onClick={() => handleViewReport(task.id)}
                  >
                    查看报告
                  </Button>
                ),
                <Button 
                  type="link" 
                  danger
                  onClick={() => handleDeleteTask(task.id)}
                >
                  删除
                </Button>,
              ].filter(Boolean)}
            >
              <List.Item.Meta
                avatar={<GithubOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                title={
                  <Space>
                    {task.repoName}
                    {getStatusTag(task.status)}
                    {task.report && (
                      <Tag color="red" icon={<BugOutlined />}>
                        {task.report.totalIssues} 个问题
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <Text type="secondary">分支: {task.branch}</Text>
                    <Text type="secondary">
                      创建时间: {new Date(task.startTime).toLocaleString()}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
      
      {/* 报告查看对话框 */}
      <Modal
        title={`审计报告 - ${selectedTask?.task.repoName}`}
        open={reportVisible}
        onCancel={() => setReportVisible(false)}
        footer={null}
        width={1000}
        style={{ top: 20 }}
      >
        {selectedTask && (
          <Tabs
            items={[
              {
                key: 'overview',
                label: '概览',
                children: (
                  <div>
                    <Card size="small" style={{ marginBottom: 16 }}>
                      <Statistic.Group>
                        <Statistic title="总问题" value={selectedTask.report.totalIssues} />
                        <Statistic 
                          title="严重" 
                          value={selectedTask.report.criticalIssues} 
                          valueStyle={{ color: '#cf1322' }} 
                        />
                        <Statistic 
                          title="高危" 
                          value={selectedTask.report.highIssues} 
                          valueStyle={{ color: '#fa8c16' }} 
                        />
                        <Statistic 
                          title="中危" 
                          value={selectedTask.report.mediumIssues} 
                          valueStyle={{ color: '#faad14' }} 
                        />
                        <Statistic 
                          title="低危" 
                          value={selectedTask.report.lowIssues} 
                          valueStyle={{ color: '#52c41a' }} 
                        />
                      </Statistic.Group>
                    </Card>
                    
                    <Card size="small" title="代码统计">
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <div>扫描文件: {selectedTask.report.filesScanned}</div>
                        <div>代码行数: {selectedTask.report.linesOfCode.toLocaleString()}</div>
                        <div>
                          语言分布: {Object.entries(selectedTask.report.metrics.filesByLanguage)
                            .map(([lang, count]) => `${lang}(${count})`)
                            .join(', ')}
                        </div>
                      </Space>
                    </Card>
                  </div>
                ),
              },
              {
                key: 'issues',
                label: `问题列表 (${selectedTask.report.totalIssues})`,
                children: (
                  <List
                    dataSource={selectedTask.report.issues}
                    pagination={{ pageSize: 5 }}
                    renderItem={(issue: Issue) => (
                      <List.Item>
                        <List.Item.Meta
                          title={
                            <Space>
                              <Tag color={getSeverityColor(issue.severity)}>
                                {issue.severity.toUpperCase()}
                              </Tag>
                              <Text strong>{issue.title}</Text>
                              {issue.cwe && <Tag>{issue.cwe}</Tag>}
                            </Space>
                          }
                          description={
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Text>{issue.description}</Text>
                              <Text code>{issue.file}:{issue.line}</Text>
                              <pre style={{ 
                                background: '#f5f5f5', 
                                padding: 8, 
                                borderRadius: 4,
                                overflow: 'auto',
                              }}>
                                {issue.code}
                              </pre>
                              <div style={{ color: '#52c41a' }}>
                                💡 修复建议: {issue.suggestion}
                              </div>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ),
              },
              {
                key: 'ai',
                label: 'AI 洞察',
                children: (
                  <Card>
                    <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                      {selectedTask.report.aiInsights}
                    </Paragraph>
                  </Card>
                ),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
};

export default CodeAudit;
