import { useState, useEffect, useRef } from 'react';
import { Card, Input, Button, List, Avatar, Space, message, Select } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, DatabaseOutlined, CopyOutlined } from '@ant-design/icons';
import { ChatMessage } from '../../api/ai';
import { documentsApi, Document } from '../../api/documents';
import apiClient from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import './index.css';

const { TextArea } = Input;

interface Model {
  id: string;
  name: string;
  value: string;
}

const AIChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [currentProvider, setCurrentProvider] = useState('');
  const [knowledgeBases, setKnowledgeBases] = useState<Document[]>([]);
  const [selectedKBs, setSelectedKBs] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { token } = useAuthStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadModelConfig();
    loadKnowledgeBases();
  }, []);

  const loadKnowledgeBases = async () => {
    try {
      const response: any = await documentsApi.list({ page: 1, pageSize: 100 });
      // 只显示已向量化的文档
      setKnowledgeBases(response.data.filter((doc: Document) => doc.vectorized));
    } catch (error) {
      console.error('加载知识库失败:', error);
    }
  };

  const loadModelConfig = async () => {
    try {
      const response = await apiClient.get('/settings');
      const data = response as any;
      const provider = data.providers[data.selectedProvider];
      setCurrentProvider(data.selectedProvider);
      setAvailableModels(provider?.models || []);
      setSelectedModel(data.selectedModel);
      
      // 显示当前模型的欢迎消息
      const currentModel = provider?.models.find((m: any) => m.value === data.selectedModel);
      if (currentModel) {
        const welcomeMessage: ChatMessage = {
          role: 'system',
          content: `当前使用 ${currentModel.name} 模型`,
          timestamp: new Date().toISOString(),
        };
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error('加载模型配置失败:', error);
    }
  };

  const handleModelChange = async (modelValue: string) => {
    const model = availableModels.find(m => m.value === modelValue);
    if (model) {
      const previousModel = availableModels.find(m => m.value === selectedModel);
      setSelectedModel(modelValue);
      
      // 添加系统提示消息
      const systemMessage: ChatMessage = {
        role: 'system',
        content: `已切换到 ${model.name} 模型${previousModel ? `（从 ${previousModel.name}）` : ''}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, systemMessage]);
      
      // 保存到后端配置
      try {
        await apiClient.post('/settings', {
          selectedProvider: currentProvider,
          selectedModel: modelValue,
        });
        message.success(`已切换到 ${model.name} 模型`);
      } catch (error) {
        message.error('切换模型失败');
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    // 创建一个空的 AI 消息用于流式更新
    const assistantMessageIndex = newMessages.length; // 这是助手消息的索引
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // 发送给 API 时移除 timestamp 和 system 消息
      const apiMessages = newMessages
        .filter(msg => msg.role !== 'system')
        .map(({ role, content }) => ({
          role,
          content,
        }));

      const apiUrl = 'http://localhost:3000/api/ai/chat-stream';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          model: selectedModel,
          knowledgeBaseIds: selectedKBs,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
                if (parsed.content) {
                  // 使用函数式更新，确保状态正确累积
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const currentContent = newMessages[assistantMessageIndex]?.content || '';
                    newMessages[assistantMessageIndex] = {
                      ...newMessages[assistantMessageIndex],
                      content: currentContent + parsed.content,
                    };
                    return newMessages;
                  });
                }
              } catch (e: any) {
                if (e.message && !e.message.includes('Unexpected')) {
                  throw e;
                }
              }
            }
          }
        }
        
        // 流结束后，更新消息添加模型信息
        const currentModel = availableModels.find(m => m.value === selectedModel);
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[assistantMessageIndex] = {
            ...newMessages[assistantMessageIndex],
            model: currentModel?.name || selectedModel,
          };
          return newMessages;
        });
      }
    } catch (error: any) {
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[assistantMessageIndex] = {
          ...newMessages[assistantMessageIndex],
          content: `错误：${error.message || '请求失败'}`,
        };
        return newMessages;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-chat-container">
      <Card
        title="AI对话助手"
        extra={
          <Space>
            <span style={{ fontSize: 12, color: '#999' }}>模型：</span>
            <Select
              value={selectedModel}
              onChange={handleModelChange}
              style={{ width: 250 }}
              placeholder="选择模型"
              options={availableModels.map(m => ({
                label: m.name,
                value: m.value,
              }))}
            />
            <Button 
              size="small" 
              onClick={() => {
                const currentModel = availableModels.find(m => m.value === selectedModel);
                const welcomeMessage: ChatMessage = {
                  role: 'system',
                  content: `当前使用 ${currentModel?.name || '未知'} 模型`,
                  timestamp: new Date().toISOString(),
                };
                setMessages([welcomeMessage]);
                message.success('对话已清空');
              }}
            >
              清空对话
            </Button>
          </Space>
        }
      >
        {/* 知识库选择器 - 移到顶部 */}
        <div style={{ marginBottom: 12, padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Space>
              <DatabaseOutlined style={{ color: '#1890ff' }} />
              <span style={{ fontWeight: 500 }}>知识库增强：</span>
            </Space>
            <Select
              mode="multiple"
              value={selectedKBs}
              onChange={setSelectedKBs}
              placeholder="选择知识库文档（可多选）"
              style={{ width: '100%' }}
              size="small"
              maxTagCount="responsive"
              options={knowledgeBases.map(kb => ({
                label: `${kb.title} (${kb.category})`,
                value: kb.id,
              }))}
              allowClear
            />
            {selectedKBs.length > 0 && (
              <div style={{ fontSize: 12, color: '#52c41a' }}>
                ✓ 已选择 {selectedKBs.length} 个知识库，AI将基于这些文档回答问题
              </div>
            )}
          </Space>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 100px)' }}>
          {/* 消息列表 */}
          <div className="chat-messages">
          <List
            dataSource={messages}
            renderItem={(msg) => (
              <List.Item 
                className={`message-${msg.role}`}
                style={{
                  justifyContent: msg.role === 'user' ? 'flex-end' : 
                                 msg.role === 'system' ? 'center' : 'flex-start',
                }}
              >
                {msg.role === 'system' ? (
                  <div style={{ 
                    padding: '8px 16px', 
                    background: '#f0f0f0', 
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#666',
                  }}>
                    {msg.content}
                  </div>
                ) : (
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                        style={{
                          backgroundColor: msg.role === 'user' ? '#1890ff' : '#52c41a',
                        }}
                      />
                    }
                    title={msg.role === 'user' ? '你' : 'AI助手'}
                    description={
                      <div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {msg.content || (loading && msg.role === 'assistant' ? (
                            <span style={{ color: '#999' }}>
                              <span className="typing-indicator">正在思考</span>
                            </span>
                          ) : '')}
                        </div>
                        {/* AI回答的元信息 */}
                        {msg.role === 'assistant' && msg.content && !loading && (
                          <div style={{ 
                            marginTop: 12, 
                            paddingTop: 8, 
                            borderTop: '1px solid #f0f0f0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            fontSize: 12,
                            color: '#999',
                          }}>
                            {msg.model && (
                              <span>
                                <span style={{ color: '#666' }}>模型：</span>
                                <span style={{ color: '#1890ff' }}>{msg.model}</span>
                              </span>
                            )}
                            {msg.tokens && (
                              <span>
                                <span style={{ color: '#666' }}>Tokens：</span>
                                <span style={{ color: '#52c41a' }}>{msg.tokens}</span>
                              </span>
                            )}
                            <Button
                              type="link"
                              size="small"
                              icon={<CopyOutlined />}
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                message.success('已复制到剪贴板');
                              }}
                              style={{ padding: 0, height: 'auto' }}
                            >
                              复制
                            </Button>
                          </div>
                        )}
                      </div>
                    }
                  />
                )}
              </List.Item>
            )}
          />
          <div ref={messagesEndRef} />
        </div>
        
        {/* 输入框 */}
        <div style={{ flexShrink: 0 }}>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的问题..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={loading}
            onClick={handleSend}
          >
            发送
          </Button>
        </Space.Compact>
        </div>
        </div>
      </Card>
    </div>
  );
};

export default AIChat;
