import { useState, useEffect, useRef } from 'react';
import { Input, Button, Avatar, Space, message, Select, Tooltip } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, DatabaseOutlined, CopyOutlined, DeleteOutlined, BulbOutlined } from '@ant-design/icons';
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
    } catch (error) {
      console.error('加载模型配置失败:', error);
    }
  };

  const handleModelChange = async (modelValue: string) => {
    const model = availableModels.find(m => m.value === modelValue);
    if (model) {
      setSelectedModel(modelValue);
      const systemMessage: ChatMessage = {
        role: 'system',
        content: `已切换到 ${model.name}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, systemMessage]);
      try {
        await apiClient.post('/settings', { selectedProvider: currentProvider, selectedModel: modelValue });
        message.success(`已切换到 ${model.name}`);
      } catch {
        message.error('切换模型失败');
      }
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    message.success('对话已清空');
  };

  const quickPrompts = [
    '帮我写一段项目总结',
    '解释一下什么是微服务架构',
    '帮我优化这段代码的性能',
    '生成一份技术方案文档',
  ];

  const handleSend = async (text?: string) => {
    const content = text || input;
    if (!content.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const assistantMessageIndex = newMessages.length;
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const apiMessages = newMessages
        .filter(msg => msg.role !== 'system')
        .map(({ role, content }) => ({ role, content }));

      const apiUrl = 'http://localhost:3000/api/ai/chat-stream';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: apiMessages, model: selectedModel, knowledgeBaseIds: selectedKBs }),
      });

      if (!response.ok) {
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
                if (parsed.error) throw new Error(parsed.error);
                if (parsed.content) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const current = updated[assistantMessageIndex]?.content || '';
                    updated[assistantMessageIndex] = { ...updated[assistantMessageIndex], content: current + parsed.content };
                    return updated;
                  });
                }
              } catch (e: any) {
                if (e.message && !e.message.includes('Unexpected')) throw e;
              }
            }
          }
        }
        const currentModel = availableModels.find(m => m.value === selectedModel);
        setMessages((prev) => {
          const updated = [...prev];
          updated[assistantMessageIndex] = { ...updated[assistantMessageIndex], model: currentModel?.name || selectedModel };
          return updated;
        });
      }
    } catch (error: any) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[assistantMessageIndex] = { ...updated[assistantMessageIndex], content: `错误：${error.message || '请求失败'}` };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const hasMessages = messages.filter(m => m.role !== 'system').length > 0;

  return (
    <div className="chat-page">
      {/* Top bar */}
      <div className="chat-topbar">
        <div className="chat-topbar-left">
          <span className="chat-topbar-title">AI 对话</span>
          <Select
            value={selectedModel}
            onChange={handleModelChange}
            style={{ width: 220 }}
            size="small"
            variant="borderless"
            placeholder="选择模型"
            options={availableModels.map(m => ({ label: m.name, value: m.value }))}
          />
        </div>
        <Space size={4}>
          {knowledgeBases.length > 0 && (
            <Select
              mode="multiple"
              value={selectedKBs}
              onChange={setSelectedKBs}
              placeholder="关联知识库"
              size="small"
              style={{ minWidth: 180 }}
              maxTagCount={1}
              suffixIcon={<DatabaseOutlined />}
              options={knowledgeBases.map(kb => ({ label: kb.title, value: kb.id }))}
              allowClear
            />
          )}
          <Tooltip title="清空对话">
            <Button size="small" icon={<DeleteOutlined />} type="text" onClick={handleClearChat} />
          </Tooltip>
        </Space>
      </div>

      {/* Messages area */}
      <div className="chat-messages">
        {!hasMessages ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <RobotOutlined />
            </div>
            <h3 className="chat-empty-title">开始一段新对话</h3>
            <p className="chat-empty-desc">选择下方的快捷提问，或直接输入你的问题</p>
            <div className="chat-quick-prompts">
              {quickPrompts.map((prompt, i) => (
                <button key={i} className="chat-quick-btn" onClick={() => handleSend(prompt)}>
                  <BulbOutlined style={{ marginRight: 6, opacity: 0.5 }} />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-messages-inner">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`chat-msg chat-msg-${msg.role}`}
              >
                {msg.role === 'system' ? (
                  <div className="chat-system-msg">{msg.content}</div>
                ) : (
                  <div className="chat-msg-row">
                    <Avatar
                      size={32}
                      icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                      className={`chat-avatar chat-avatar-${msg.role}`}
                    />
                    <div className={`chat-bubble chat-bubble-${msg.role}`}>
                      <div className="chat-bubble-content">
                        {msg.content || (loading && msg.role === 'assistant' ? (
                          <span className="typing-indicator">正在思考</span>
                        ) : '')}
                      </div>
                      {msg.role === 'assistant' && msg.content && !loading && (
                        <div className="chat-bubble-meta">
                          {msg.model && <span className="chat-meta-model">{msg.model}</span>}
                          <Tooltip title="复制">
                            <button
                              className="chat-meta-btn"
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                message.success('已复制到剪贴板');
                              }}
                            >
                              <CopyOutlined />
                            </button>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        {selectedKBs.length > 0 && (
          <div className="chat-kb-hint">
            <DatabaseOutlined style={{ marginRight: 4 }} />
            已关联 {selectedKBs.length} 个知识库
          </div>
        )}
        <div className="chat-input-row">
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的问题，Shift+Enter 换行..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="chat-textarea"
          />
          <Button
            type="primary"
            shape="circle"
            icon={<SendOutlined />}
            loading={loading}
            onClick={() => handleSend()}
            className="chat-send-btn"
          />
        </div>
      </div>
    </div>
  );
};

export default AIChat;
