import { Card, Form, Input, Select, Button, Space, message, InputNumber, Tabs, List, Modal, Tag, Alert, Typography } from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined, EditOutlined, KeyOutlined, ApiOutlined, DatabaseOutlined, FileTextOutlined, LockOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import './index.css';

const { TextArea } = Input;
const { Title } = Typography;

interface ApiKey {
  id: string;
  name: string;
  key: string;
}

interface Model {
  id: string;
  name: string;
  value: string;
}

const SystemSettings = () => {
  const [form] = Form.useForm();
  const [knowledgeBaseForm] = Form.useForm();
  const [config, setConfig] = useState<any>(null);
  const [selectedProvider, setSelectedProvider] = useState('fireworks');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [apiKeyForm] = Form.useForm();
  const [modelForm] = Form.useForm();
  const [urlForm] = Form.useForm();
  const [templateForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const { user } = useAuthStore();
  
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    loadSettings();
  }, []);

  // 当配置加载后，更新知识库表单的值
  useEffect(() => {
    if (config?.knowledgeBase) {
      knowledgeBaseForm.setFieldsValue({
        embeddingModel: config.knowledgeBase.embeddingModel || 'accounts/fireworks/models/qwen3-embedding-8b',
        rerankerModel: config.knowledgeBase.rerankerModel || 'accounts/fireworks/models/qwen3-reranker-8b',
        useReranker: config.knowledgeBase.useReranker !== undefined ? config.knowledgeBase.useReranker : true,
        chunkSize: config.knowledgeBase.chunkSize || 500,
        chunkOverlap: config.knowledgeBase.chunkOverlap || 50,
        topK: config.knowledgeBase.topK || 5,
        rerankTopN: config.knowledgeBase.rerankTopN || 3,
      });
    }
  }, [config, knowledgeBaseForm]);

  const loadSettings = async () => {
    try {
      const response: any = await apiClient.get('/settings');
      setConfig(response);
      setSelectedProvider(response.selectedProvider || 'fireworks');
      form.setFieldsValue({
        selectedProvider: response.selectedProvider,
        selectedApiKey: response.selectedApiKey,
        selectedModel: response.selectedModel,
        temperature: response.temperature,
        maxTokens: response.maxTokens,
        topP: response.topP,
        topK: response.topK,
      });
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  const onFinish = async (values: any) => {
    try {
      await apiClient.post('/settings', values);
      message.success('配置保存成功');
      loadSettings();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleAddApiKey = async (values: any) => {
    try {
      await apiClient.post('/settings/api-keys', {
        provider: selectedProvider,
        ...values,
      });
      message.success('API Key 添加成功');
      setIsApiKeyModalOpen(false);
      apiKeyForm.resetFields();
      loadSettings();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    try {
      await apiClient.delete(`/settings/api-keys/${selectedProvider}/${id}`);
      message.success('API Key 删除成功');
      loadSettings();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleAddModel = async (values: any) => {
    try {
      await apiClient.post('/settings/models', {
        provider: selectedProvider,
        ...values,
      });
      message.success('模型添加成功');
      setIsModelModalOpen(false);
      modelForm.resetFields();
      loadSettings();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleDeleteModel = async (id: string) => {
    try {
      await apiClient.delete(`/settings/models/${selectedProvider}/${id}`);
      message.success('模型删除成功');
      loadSettings();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleUpdateUrl = async (values: any) => {
    try {
      await apiClient.patch(`/settings/providers/${selectedProvider}`, values);
      message.success('API URL 更新成功');
      setIsUrlModalOpen(false);
      loadSettings();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleSaveTemplate = async (values: any) => {
    try {
      if (editingTemplate) {
        await apiClient.put(`/settings/doc-templates/${editingTemplate.id}`, values);
        message.success('模板更新成功');
      } else {
        await apiClient.post('/settings/doc-templates', values);
        message.success('模板添加成功');
      }
      setIsTemplateModalOpen(false);
      setEditingTemplate(null);
      templateForm.resetFields();
      loadSettings();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await apiClient.delete(`/settings/doc-templates/${id}`);
      message.success('模板删除成功');
      loadSettings();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleChangePassword = async (values: any) => {
    try {
      await apiClient.post('/auth/change-password', values);
      message.success('密码修改成功，请重新登录');
      setIsPasswordModalOpen(false);
      passwordForm.resetFields();
      
      // 3秒后自动退出登录
      setTimeout(() => {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }, 3000);
    } catch (error: any) {
      message.error(error.response?.data?.message || '修改密码失败');
    }
  };

  const providerOptions = config ? Object.entries(config.providers).map(([key, provider]: [string, any]) => ({
    label: provider.name,
    value: key,
  })) : [];

  const currentProvider = config?.providers[selectedProvider];

  return (
    <div className="system-settings-container">
      <div className="settings-header">
        <div>
          <Title level={2} style={{ margin: 0 }}>系统设置</Title>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, marginBottom: 0 }}>
            配置 AI 模型、知识库和系统参数
          </p>
        </div>
        <Button 
          type="primary" 
          icon={<LockOutlined />}
          size="large"
          onClick={() => setIsPasswordModalOpen(true)}
        >
          修改密码
        </Button>
      </div>
      
      {!isAdmin && (
        <Alert
          message="只读模式"
          description="您是普通用户，只能查看系统设置，无法进行修改操作。"
          type="info"
          showIcon
          className="info-alert"
        />
      )}
      
      <Tabs
        className="provider-tabs"
        activeKey={selectedProvider}
        onChange={(key) => {
          setSelectedProvider(key);
          form.setFieldValue('selectedProvider', key);
        }}
        items={providerOptions.map(opt => ({
          key: opt.value,
          label: opt.label,
        }))}
      />

      <Card 
        title={
          <Space>
            <ApiOutlined />
            <span>API 配置</span>
          </Space>
        }
        className="settings-card"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* API URL */}
          <div className="config-section">
            <div className="config-section-header">
              <strong className="config-section-title">API URL</strong>
              {isAdmin && (
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    urlForm.setFieldsValue({ apiUrl: currentProvider?.apiUrl });
                    setIsUrlModalOpen(true);
                  }}
                >
                  修改
                </Button>
              )}
            </div>
            <Input 
              value={currentProvider?.apiUrl} 
              disabled 
              size="large"
              style={{ fontFamily: 'monospace' }}
            />
          </div>

          {/* API Keys */}
          <div className="config-section">
            <div className="config-section-header">
              <strong className="config-section-title">
                <Space>
                  <KeyOutlined />
                  API Keys
                </Space>
              </strong>
              {isAdmin && (
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setIsApiKeyModalOpen(true)}
                >
                  添加
                </Button>
              )}
            </div>
            <List
              className="config-list"
              size="small"
              bordered
              dataSource={currentProvider?.apiKeys || []}
              locale={{ emptyText: '暂无 API Key，请添加' }}
              renderItem={(item: ApiKey) => (
                <List.Item
                  actions={isAdmin ? [
                    <Button
                      type="link"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteApiKey(item.id)}
                    >
                      删除
                    </Button>,
                  ] : []}
                >
                  <div className="api-key-item">
                    <Tag color="blue" className="api-key-tag">{item.name}</Tag>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {item.key}
                    </span>
                  </div>
                </List.Item>
              )}
            />
          </div>

          {/* Models */}
          <div className="config-section">
            <div className="config-section-header">
              <strong className="config-section-title">
                <Space>
                  <DatabaseOutlined />
                  可用模型
                </Space>
              </strong>
              {isAdmin && (
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setIsModelModalOpen(true)}
                >
                  添加
                </Button>
              )}
            </div>
            <List
              className="config-list"
              size="small"
              bordered
              dataSource={currentProvider?.models || []}
              locale={{ emptyText: '暂无模型，请添加' }}
              renderItem={(item: Model) => (
                <List.Item
                  actions={isAdmin ? [
                    <Button
                      type="link"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteModel(item.id)}
                    >
                      删除
                    </Button>,
                  ] : []}
                >
                  <div className="model-item">
                    <Tag color="green" className="model-tag">{item.name}</Tag>
                    <span className="model-value">{item.value}</span>
                  </div>
                </List.Item>
              )}
            />
          </div>
        </Space>
      </Card>

      {/* 向量模型配置 */}
      <Card 
        title={
          <Space>
            <span>知识库配置</span>
            <Tag color="blue">Embedding & Reranker</Tag>
          </Space>
        } 
        style={{ marginBottom: 16 }}
      >
        <Form
          form={knowledgeBaseForm}
          layout="vertical"
          onFinish={async (values) => {
            try {
              await apiClient.post('/settings/knowledge-base', values);
              message.success('知识库配置保存成功');
              loadSettings();
            } catch (error) {
              message.error('保存失败');
            }
          }}
        >
          <Alert
            message="知识库配置说明"
            description="配置Embedding模型用于文档向量化，Reranker模型用于搜索结果重排序，提高检索准确度。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Form.Item
            label="Embedding 模型"
            name="embeddingModel"
            tooltip="用于将文档和查询转换为向量"
            rules={[{ required: true, message: '请输入 Embedding 模型' }]}
          >
            <Input 
              placeholder="accounts/fireworks/models/qwen3-embedding-8b"
              disabled={!isAdmin}
            />
          </Form.Item>

          <Form.Item
            label="Reranker 模型"
            name="rerankerModel"
            tooltip="用于重排序搜索结果，提高准确度"
            rules={[{ required: true, message: '请输入 Reranker 模型' }]}
          >
            <Input 
              placeholder="accounts/fireworks/models/qwen3-reranker-8b"
              disabled={!isAdmin}
            />
          </Form.Item>

          <Form.Item
            label="启用 Reranker"
            name="useReranker"
            tooltip="启用后会使用Reranker模型重排序搜索结果"
            rules={[{ required: true, message: '请选择是否启用 Reranker' }]}
          >
            <Select disabled={!isAdmin}>
              <Select.Option value={true}>启用</Select.Option>
              <Select.Option value={false}>禁用</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="文档分块大小"
            name="chunkSize"
            tooltip="每个文档块的字符数"
            rules={[{ required: true, message: '请输入文档分块大小' }]}
          >
            <InputNumber 
              min={100} 
              max={2000} 
              step={100}
              style={{ width: '100%' }}
              disabled={!isAdmin}
            />
          </Form.Item>

          <Form.Item
            label="分块重叠大小"
            name="chunkOverlap"
            tooltip="相邻块之间的重叠字符数，保持上下文连贯性"
            rules={[{ required: true, message: '请输入分块重叠大小' }]}
          >
            <InputNumber 
              min={0} 
              max={200} 
              step={10}
              style={{ width: '100%' }}
              disabled={!isAdmin}
            />
          </Form.Item>

          <Form.Item
            label="向量搜索 Top K"
            name="topK"
            tooltip="向量搜索返回的候选结果数量"
            rules={[{ required: true, message: '请输入向量搜索 Top K' }]}
          >
            <InputNumber 
              min={1} 
              max={20} 
              style={{ width: '100%' }}
              disabled={!isAdmin}
            />
          </Form.Item>

          <Form.Item
            label="Rerank Top N"
            name="rerankTopN"
            tooltip="Reranker重排序后返回的最终结果数量"
            rules={[{ required: true, message: '请输入 Rerank Top N' }]}
          >
            <InputNumber 
              min={1} 
              max={10} 
              style={{ width: '100%' }}
              disabled={!isAdmin}
            />
          </Form.Item>

          {isAdmin && (
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                保存配置
              </Button>
            </Form.Item>
          )}
        </Form>
      </Card>

      <Card title="使用配置">
        <Form form={form} layout="vertical" onFinish={onFinish}>

          <Form.Item 
            label="选择 API Key" 
            name="selectedApiKey"
            rules={[{ required: true, message: '请选择 API Key' }]}
          >
            <Select
              placeholder="选择要使用的 API Key"
              options={currentProvider?.apiKeys.map((k: ApiKey) => ({
                label: k.name,
                value: k.id,
              }))}
            />
          </Form.Item>

          <Form.Item 
            label="选择模型" 
            name="selectedModel"
            rules={[{ required: true, message: '请选择模型' }]}
          >
            <Select
              placeholder="选择要使用的模型"
              options={currentProvider?.models.map((m: Model) => ({
                label: m.name,
                value: m.value,
              }))}
            />
          </Form.Item>

          <Form.Item 
            label="温度参数 (Temperature)" 
            name="temperature"
            tooltip="控制输出的随机性，0-2之间"
          >
            <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item 
            label="最大Token数 (Max Tokens)" 
            name="maxTokens"
            tooltip="生成的最大token数量"
          >
            <Select
              options={[
                { label: '1K', value: 1000 },
                { label: '2K', value: 2000 },
                { label: '4K', value: 4000 },
                { label: '8K', value: 8000 },
                { label: '16K', value: 16000 },
                { label: '32K', value: 32000 },
                { label: '64K', value: 64000 },
                { label: '128K', value: 128000 },
                { label: '200K', value: 200000 },
              ]}
            />
          </Form.Item>

          <Form.Item 
            label="Top P" 
            name="topP"
            tooltip="核采样参数，0-1之间"
          >
            <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item 
            label="Top K" 
            name="topK"
            tooltip="Top-K采样参数"
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<SaveOutlined />}
                disabled={!isAdmin}
              >
                保存配置
              </Button>
              <Button onClick={() => form.resetFields()} disabled={!isAdmin}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="文档生成模板" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 16 }}>
          {isAdmin && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsTemplateModalOpen(true)}
            >
              添加模板
            </Button>
          )}
        </div>
        
        <List
          dataSource={config?.docTemplates || []}
          locale={{ emptyText: '暂无模板' }}
          renderItem={(item: any) => (
            <List.Item
              actions={[
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    Modal.info({
                      title: item.name,
                      content: (
                        <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
                          {item.content}
                        </pre>
                      ),
                      width: 600,
                    });
                  }}
                >
                  查看
                </Button>,
                ...(isAdmin ? [
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      templateForm.setFieldsValue(item);
                      setEditingTemplate(item);
                      setIsTemplateModalOpen(true);
                    }}
                  >
                    编辑
                  </Button>,
                  <Button
                    type="link"
                    danger
                    size="small"
                    onClick={() => handleDeleteTemplate(item.id)}
                  >
                    删除
                  </Button>,
                ] : []),
              ]}
            >
              <List.Item.Meta
                title={item.name}
                description={item.content.substring(0, 100) + '...'}
              />
            </List.Item>
          )}
        />
      </Card>

      {/* 添加 API Key 弹窗 */}
      <Modal
        title="添加 API Key"
        open={isApiKeyModalOpen}
        onCancel={() => {
          setIsApiKeyModalOpen(false);
          apiKeyForm.resetFields();
        }}
        onOk={() => apiKeyForm.submit()}
      >
        <Form form={apiKeyForm} layout="vertical" onFinish={handleAddApiKey}>
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="例如：生产环境" />
          </Form.Item>
          <Form.Item
            label="API Key"
            name="key"
            rules={[{ required: true, message: '请输入 API Key' }]}
          >
            <Input.Password placeholder="输入 API Key" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加模型弹窗 */}
      <Modal
        title="添加模型"
        open={isModelModalOpen}
        onCancel={() => {
          setIsModelModalOpen(false);
          modelForm.resetFields();
        }}
        onOk={() => modelForm.submit()}
      >
        <Form form={modelForm} layout="vertical" onFinish={handleAddModel}>
          <Form.Item
            label="模型名称"
            name="name"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="例如：GPT-4" />
          </Form.Item>
          <Form.Item
            label="模型标识"
            name="value"
            rules={[{ required: true, message: '请输入模型标识' }]}
          >
            <Input placeholder="例如：gpt-4" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改 URL 弹窗 */}
      <Modal
        title="修改 API URL"
        open={isUrlModalOpen}
        onCancel={() => {
          setIsUrlModalOpen(false);
          urlForm.resetFields();
        }}
        onOk={() => urlForm.submit()}
      >
        <Form form={urlForm} layout="vertical" onFinish={handleUpdateUrl}>
          <Form.Item
            label="API URL"
            name="apiUrl"
            rules={[{ required: true, message: '请输入 API URL' }]}
          >
            <Input placeholder="https://api.example.com/v1/chat/completions" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 模板编辑弹窗 */}
      <Modal
        title={editingTemplate ? '编辑模板' : '添加模板'}
        open={isTemplateModalOpen}
        onCancel={() => {
          setIsTemplateModalOpen(false);
          setEditingTemplate(null);
          templateForm.resetFields();
        }}
        onOk={() => templateForm.submit()}
        width={700}
      >
        <Form form={templateForm} layout="vertical" onFinish={handleSaveTemplate}>
          <Form.Item
            label="模板名称"
            name="name"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="例如：API文档生成" />
          </Form.Item>
          <Form.Item
            label="模板内容"
            name="content"
            rules={[{ required: true, message: '请输入模板内容' }]}
          >
            <TextArea
              rows={12}
              placeholder="请输入文档生成要求模板，例如：&#10;- 分析代码结构和主要功能&#10;- 生成详细的API文档&#10;- 包含参数说明和返回值&#10;- 提供使用示例"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={isPasswordModalOpen}
        onCancel={() => {
          setIsPasswordModalOpen(false);
          passwordForm.resetFields();
        }}
        onOk={() => passwordForm.submit()}
      >
        <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
          <Form.Item
            label="旧密码"
            name="oldPassword"
            rules={[{ required: true, message: '请输入旧密码' }]}
          >
            <Input.Password placeholder="请输入当前密码" />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度至少为6位' },
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SystemSettings;
