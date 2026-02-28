import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Space, message, Upload, Select, Radio, Tabs, Statistic, Row, Col } from 'antd';
import { FileTextOutlined, DownloadOutlined, CopyOutlined, UploadOutlined, InboxOutlined, ClockCircleOutlined, ApiOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import ReactMarkdown from 'react-markdown';
import apiClient from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import PageHeader from '../../components/PageHeader';
import './index.css';

const { TextArea } = Input;
const { Dragger } = Upload;

interface Template {
  id: string;
  name: string;
  content: string;
}

interface Model {
  id: string;
  name: string;
  value: string;
}

const DocumentGeneration = () => {
  const [form] = Form.useForm();
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedContentEn, setGeneratedContentEn] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [currentProvider, setCurrentProvider] = useState('');
  const [language, setLanguage] = useState<'chinese' | 'english' | 'both'>('chinese');
  const [activeTab, setActiveTab] = useState<'chinese' | 'english'>('chinese');
  const [statistics, setStatistics] = useState<{
    duration: number;
    tokens: number;
    startTime: number;
  } | null>(null);
  const [chineseLoading, setChineseLoading] = useState(false);
  const [englishLoading, setEnglishLoading] = useState(false);
  const [chineseProgress, setChineseProgress] = useState('');
  const [englishProgress, setEnglishProgress] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadTemplates();
    loadModels();
  }, []);

  // 加载模板
  const loadTemplates = async () => {
    try {
      const response = await apiClient.get('/settings');
      setTemplates(response.docTemplates || []);
    } catch (error) {
      console.error('加载模板失败:', error);
    }
  };

  // 加载模型
  const loadModels = async () => {
    try {
      const response = await apiClient.get('/settings');
      const provider = response.providers[response.selectedProvider];
      setCurrentProvider(response.selectedProvider);
      setAvailableModels(provider?.models || []);
      setSelectedModel(response.selectedModel);
      form.setFieldValue('model', response.selectedModel);
    } catch (error) {
      console.error('加载模型失败:', error);
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.java,.h',
    beforeUpload: (file) => {
      const isValidType = file.name.endsWith('.java') || file.name.endsWith('.h');
      
      if (!isValidType) {
        message.error('只支持 .java 和 .h 文件');
        return false;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const rawContent = e.target?.result as string;
        
        // 压缩代码：去除空行和多余空格
        const compressedContent = compressCode(rawContent);
        
        setFileContent(compressedContent);
        setUploadedFile(file);
        
        // 使用文件名作为默认标题（去掉扩展名）
        const fileName = file.name.replace(/\.(java|h)$/, '');
        form.setFieldValue('title', fileName);
        setDocumentTitle(fileName);
        
        // 显示压缩效果
        const originalSize = rawContent.length;
        const compressedSize = compressedContent.length;
        const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
        
        message.success(
          `文件 ${file.name} 上传成功，已压缩 ${ratio}% (${originalSize} → ${compressedSize} 字符)`
        );
      };
      reader.readAsText(file);
      
      return false; // 阻止自动上传
    },
    onDrop: (e) => {
      console.log('Dropped files', e.dataTransfer.files);
    },
  };

  // 代码压缩函数
  const compressCode = (code: string): string => {
    return code
      // 1. 移除多行注释 /* ... */
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // 2. 移除单行注释 //
      .replace(/\/\/.*$/gm, '')
      // 3. 移除空行
      .replace(/^\s*[\r\n]/gm, '')
      // 4. 移除行首行尾空格
      .replace(/^\s+|\s+$/gm, '')
      // 5. 压缩多个连续空格为单个空格（保留缩进结构）
      .replace(/[ \t]+/g, ' ')
      // 6. 移除空格在特定符号前后（可选，谨慎使用）
      // .replace(/\s*([{}();,])\s*/g, '$1')
      .trim();
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      form.setFieldValue('requirements', template.content);
    }
  };

  const handleGenerate = async (values: any) => {
    if (!uploadedFile) {
      message.error('请先上传代码文件');
      return;
    }

    setLoading(true);
    setDocumentTitle(values.title);
    setGeneratedContent('');
    setGeneratedContentEn('');
    setStatistics(null);
    setChineseProgress('');
    setEnglishProgress('');
    setElapsedTime(0);
    
    // 启动计时器
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    setTimerInterval(interval);
    
    const startTime = Date.now();
    
    try {
      if (language === 'both') {
        // 中英文并行生成
        setActiveTab('chinese');
        setChineseLoading(true);
        setEnglishLoading(true);
        
        // 启动两个并行任务
        const chinesePromise = generateDocumentParallel('chinese', values, (content) => {
          setGeneratedContent(content);
        }, (progress) => {
          setChineseProgress(progress);
        }).finally(() => {
          setChineseLoading(false);
        });
        
        const englishPromise = generateDocumentParallel('english', values, (content) => {
          setGeneratedContentEn(content);
        }, (progress) => {
          setEnglishProgress(progress);
        }).finally(() => {
          setEnglishLoading(false);
        });
        
        // 等待两个任务都完成
        await Promise.all([chinesePromise, englishPromise]);
        
        const duration = Date.now() - startTime;
        setStatistics({
          duration,
          tokens: 0, // 双语模式暂不统计 tokens
          startTime,
        });
        
        message.success(`双语文档生成成功（耗时 ${(duration / 1000).toFixed(1)}s）`);
      } else {
        // 单语言生成
        const controller = new AbortController();
        let totalTokens = 0;
        
        await generateDocument(language, values, controller.signal, (content) => {
          setGeneratedContent(content);
        }, (tokens) => {
          totalTokens = tokens;
        });
        
        const duration = Date.now() - startTime;
        setStatistics({
          duration,
          tokens: totalTokens,
          startTime,
        });
        
        message.success(`文档生成成功（耗时 ${(duration / 1000).toFixed(1)}s，${totalTokens} tokens）`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        message.error('请求已取消');
      } else if (error.message.includes('无响应')) {
        message.error(error.message + '，请检查网络或重试');
      } else {
        message.error(error.message || '生成失败');
      }
    } finally {
      setLoading(false);
      setChineseLoading(false);
      setEnglishLoading(false);
      // 清除计时器
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
    }
  };

  const generateDocumentParallel = async (
    lang: 'chinese' | 'english',
    values: any,
    onContent: (content: string) => void,
    onProgress: (progress: string) => void
  ) => {
    const response = await fetch(
      `${(import.meta as any).env?.VITE_API_BASE_URL || '/api'}/documents/generate-from-code-stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: values.title,
          fileName: uploadedFile!.name,
          fileContent: fileContent,
          requirements: values.requirements,
          model: values.model,
          language: lang,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`${lang === 'chinese' ? '中文' : '英文'}文档生成失败`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      let accumulatedContent = '';
      let lastDataTime = Date.now();
      const TIMEOUT = 30000;

      onProgress('正在生成...');

      const timeoutChecker = setInterval(() => {
        const now = Date.now();
        if (now - lastDataTime > TIMEOUT) {
          clearInterval(timeoutChecker);
          reader.cancel();
          throw new Error(`${lang === 'chinese' ? '中文' : '英文'}文档 API 超过 ${TIMEOUT / 1000} 秒无响应`);
        }
      }, 1000);

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            clearInterval(timeoutChecker);
            onProgress('生成完成');
            break;
          }

          lastDataTime = Date.now();

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                clearInterval(timeoutChecker);
                onProgress('生成完成');
                break;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  clearInterval(timeoutChecker);
                  throw new Error(parsed.error);
                }
                if (parsed.content) {
                  accumulatedContent += parsed.content;
                  onContent(accumulatedContent);
                  onProgress(`已生成 ${accumulatedContent.length} 字符`);
                }
              } catch (e: any) {
                if (e.message && !e.message.includes('Unexpected')) {
                  throw e;
                }
              }
            }
          }
        }
      } catch (error) {
        clearInterval(timeoutChecker);
        throw error;
      }
    }
  };

  const generateDocument = async (
    lang: 'chinese' | 'english',
    values: any,
    signal: AbortSignal,
    onContent: (content: string) => void,
    onTokens: (tokens: number) => void
  ) => {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL || '/api'}/documents/generate-from-code-stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: values.title,
          fileName: uploadedFile!.name,
          fileContent: fileContent,
          requirements: values.requirements,
          model: values.model,
          language: lang,
        }),
        signal,
      }
    );

    if (!response.ok) {
      throw new Error('生成失败');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      let accumulatedContent = '';
      let tokens = 0;
      let lastDataTime = Date.now();
      const TIMEOUT = 30000; // 30秒无响应超时

      // 创建超时检测
      const timeoutChecker = setInterval(() => {
        const now = Date.now();
        if (now - lastDataTime > TIMEOUT) {
          clearInterval(timeoutChecker);
          reader.cancel();
          throw new Error(`API 超过 ${TIMEOUT / 1000} 秒无响应`);
        }
      }, 1000);

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            clearInterval(timeoutChecker);
            break;
          }

          // 收到数据，更新时间
          lastDataTime = Date.now();

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                clearInterval(timeoutChecker);
                break;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  clearInterval(timeoutChecker);
                  throw new Error(parsed.error);
                }
                if (parsed.content) {
                  accumulatedContent += parsed.content;
                  onContent(accumulatedContent);
                }
                if (parsed.tokens) {
                  tokens = parsed.tokens;
                }
              } catch (e: any) {
                if (e.message && !e.message.includes('Unexpected')) {
                  throw e;
                }
                // 忽略 JSON 解析错误
              }
            }
          }
        }
      } catch (error) {
        clearInterval(timeoutChecker);
        throw error;
      }

      onTokens(tokens);
    }
  };

  const handleDownloadMarkdown = () => {
    const content = language === 'both' && activeTab === 'english' 
      ? generatedContentEn 
      : generatedContent;
    const suffix = language === 'both' ? `_${activeTab}` : '';
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentTitle || '文档'}${suffix}.md`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('Markdown 文件已下载');
  };

  const handleDownloadPDF = async () => {
    try {
      const content = language === 'both' && activeTab === 'english' 
        ? generatedContentEn 
        : generatedContent;
      const suffix = language === 'both' ? `_${activeTab}` : '';
      
      message.loading('正在生成 PDF...', 0);
      
      const response = await apiClient.post('/documents/convert-pdf', {
        content: content,
        title: documentTitle,
      }, {
        responseType: 'blob',
      });

      const blob = new Blob([response], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documentTitle || '文档'}${suffix}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      
      message.destroy();
      message.success('PDF 文件已下载');
    } catch (error) {
      message.destroy();
      message.error('PDF 生成失败');
    }
  };

  const handleCopy = () => {
    const content = language === 'both' && activeTab === 'english' 
      ? generatedContentEn 
      : generatedContent;
    navigator.clipboard.writeText(content);
    message.success('内容已复制到剪贴板');
  };

  return (
    <div className="document-generation">
      <PageHeader
        title="文档生成"
        description="上传代码文件，AI 自动生成技术文档"
      />

      <Card title="上传代码文件" style={{ marginBottom: 16 }}>
        <Dragger {...uploadProps}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 .java 和 .h 文件
          </p>
        </Dragger>
        
        {uploadedFile && (
          <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <Space>
              <FileTextOutlined style={{ color: '#1890ff' }} />
              <span>已上传：{uploadedFile.name}</span>
              <span style={{ color: '#999' }}>({(uploadedFile.size / 1024).toFixed(2)} KB)</span>
            </Space>
          </div>
        )}
      </Card>

      <Card title="文档配置" style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleGenerate}
        >
          <Form.Item
            label="文档标题"
            name="title"
            rules={[{ required: true, message: '请输入文档标题' }]}
          >
            <Input
              placeholder="默认使用文件名，可编辑"
              prefix={<FileTextOutlined />}
            />
          </Form.Item>

          <Form.Item
            label="选择模型"
            name="model"
            rules={[{ required: true, message: '请选择模型' }]}
          >
            <Select
              placeholder="选择生成模型"
              value={selectedModel}
              onChange={setSelectedModel}
              options={availableModels.map(m => ({
                label: m.name,
                value: m.value,
              }))}
            />
          </Form.Item>

          <Form.Item label="输出语言">
            <Radio.Group value={language} onChange={(e) => setLanguage(e.target.value)}>
              <Radio.Button value="chinese">中文</Radio.Button>
              <Radio.Button value="english">英文</Radio.Button>
              <Radio.Button value="both">中英文</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="生成要求模板">
            <Select
              placeholder="选择模板（可选）"
              allowClear
              value={selectedTemplate}
              onChange={handleTemplateChange}
              options={templates.map(t => ({
                label: t.name,
                value: t.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="生成要求"
            name="requirements"
            rules={[{ required: true, message: '请输入生成要求' }]}
          >
            <TextArea
              rows={8}
              placeholder="请描述文档生成要求，例如：&#10;- 分析代码结构和功能&#10;- 生成API文档&#10;- 包含使用示例&#10;- 说明参数和返回值"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<FileTextOutlined />}
                disabled={!uploadedFile}
              >
                {loading ? '生成中...' : '生成文档'}
              </Button>
              <Button onClick={() => {
                form.resetFields();
                setUploadedFile(null);
                setFileContent('');
                setGeneratedContent('');
                setSelectedTemplate('');
              }}>
                清空
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {(generatedContent || generatedContentEn || loading) && (
        <Card
          title={loading ? '正在生成文档...' : '文档预览'}
          extra={
            !loading && (
              <Space>
                {statistics && (
                  <Space size="large">
                    <Statistic
                      title="耗时"
                      value={statistics.duration / 1000}
                      suffix="秒"
                      prefix={<ClockCircleOutlined />}
                      valueStyle={{ fontSize: 14 }}
                    />
                    <Statistic
                      title="Tokens"
                      value={statistics.tokens}
                      prefix={<ApiOutlined />}
                      valueStyle={{ fontSize: 14 }}
                    />
                  </Space>
                )}
                <Button
                  icon={<CopyOutlined />}
                  onClick={handleCopy}
                >
                  复制内容
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadMarkdown}
                >
                  下载 Markdown
                </Button>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadPDF}
                >
                  下载 PDF
                </Button>
              </Space>
            )
          }
        >
          {language === 'both' ? (
            <Tabs
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key as 'chinese' | 'english')}
              items={[
                {
                  key: 'chinese',
                  label: (
                    <span>
                      中文文档
                      {chineseLoading && <span style={{ marginLeft: 8, fontSize: 12, color: '#1890ff' }}>生成中...</span>}
                      {!chineseLoading && generatedContent && <span style={{ marginLeft: 8, fontSize: 12, color: '#52c41a' }}>✓</span>}
                    </span>
                  ),
                  children: (
                    <div className="markdown-preview">
                      {chineseLoading && !generatedContent && (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                          <div className="loading-spinner"></div>
                          <p style={{ marginTop: 16, fontSize: 16 }}>
                            正在生成中文文档...
                          </p>
                          <p style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff', marginTop: 8 }}>
                            已等待 {elapsedTime} 秒
                          </p>
                          {chineseProgress && <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>{chineseProgress}</p>}
                        </div>
                      )}
                      {generatedContent && <ReactMarkdown>{generatedContent}</ReactMarkdown>}
                    </div>
                  ),
                },
                {
                  key: 'english',
                  label: (
                    <span>
                      English Document
                      {englishLoading && <span style={{ marginLeft: 8, fontSize: 12, color: '#1890ff' }}>生成中...</span>}
                      {!englishLoading && generatedContentEn && <span style={{ marginLeft: 8, fontSize: 12, color: '#52c41a' }}>✓</span>}
                    </span>
                  ),
                  children: (
                    <div className="markdown-preview">
                      {englishLoading && !generatedContentEn && (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                          <div className="loading-spinner"></div>
                          <p style={{ marginTop: 16, fontSize: 16 }}>
                            Generating English document...
                          </p>
                          <p style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff', marginTop: 8 }}>
                            Elapsed: {elapsedTime}s
                          </p>
                          {englishProgress && <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>{englishProgress}</p>}
                        </div>
                      )}
                      {generatedContentEn && <ReactMarkdown>{generatedContentEn}</ReactMarkdown>}
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <div className="markdown-preview">
              {loading && !generatedContent && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                  <div className="loading-spinner"></div>
                  <p style={{ marginTop: 16, fontSize: 16 }}>
                    AI 正在分析代码并生成文档...
                    {language === 'both' && <><br />将生成中文和英文两个版本</>}
                  </p>
                  <p style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff', marginTop: 8 }}>
                    已等待 {elapsedTime} 秒
                  </p>
                </div>
              )}
              {generatedContent && <ReactMarkdown>{generatedContent}</ReactMarkdown>}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default DocumentGeneration;
