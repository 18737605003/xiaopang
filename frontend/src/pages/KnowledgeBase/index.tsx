import { useState, useEffect } from 'react';
import { Card, Input, Button, List, Space, Tag, Upload, Modal, Select, message, Spin, Tabs, Table, InputNumber, Progress } from 'antd';
import { SearchOutlined, PlusOutlined, FileTextOutlined, DeleteOutlined, EyeOutlined, UploadOutlined, CheckCircleOutlined, SyncOutlined, EditOutlined, SaveOutlined, ExperimentOutlined } from '@ant-design/icons';
import { documentsApi, Document } from '../../api/documents';
import type { UploadFile } from 'antd/es/upload/interface';

const { TextArea } = Input;

const { Search } = Input;

const KnowledgeBase = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [category, setCategory] = useState('未分类');
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [editingChunk, setEditingChunk] = useState<any>(null);
  const [recallTestVisible, setRecallTestVisible] = useState(false);
  const [recallQuery, setRecallQuery] = useState('');
  const [recallTopK, setRecallTopK] = useState(5);
  const [recallResults, setRecallResults] = useState<any[]>([]);
  const [recallLoading, setRecallLoading] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [pagination.page, searchText, categoryFilter]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response: any = await documentsApi.list({
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: searchText,
        category: categoryFilter,
      });
      setDocuments(response.data);
      setPagination(prev => ({ ...prev, total: response.total }));
    } catch (error) {
      message.error('加载文档列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请选择文件');
      return;
    }

    setLoading(true);
    try {
      const file = fileList[0].originFileObj as File;
      const response: any = await documentsApi.upload(file, category);
      
      setUploadModalVisible(false);
      setFileList([]);
      setCategory('未分类');
      
      // 显示进度对话框
      showProgressModal(response.documentId);
      
      loadDocuments();
    } catch (error: any) {
      Modal.error({
        title: '上传失败',
        content: error.response?.data?.message || '文档上传失败',
      });
      setLoading(false);
    }
  };

  const showProgressModal = (documentId: string) => {
    let progressModal: any = null;
    let eventSource: EventSource | null = null;
    
    const closeModal = () => {
      if (eventSource) {
        eventSource.close();
      }
      if (progressModal) {
        progressModal.destroy();
      }
      setLoading(false);
    };
    
    progressModal = Modal.info({
      title: '文档向量化进度',
      content: (
        <div>
          <Progress percent={0} status="active" />
          <div style={{ marginTop: 8, color: '#666' }}>准备开始...</div>
        </div>
      ),
      okText: '后台运行',
      onOk: closeModal,
    });
    
    // 连接 SSE（注意：EventSource 不支持自定义 headers，所以通过 URL 参数传递 token）
    const token = localStorage.getItem('token');
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const sseUrl = `${apiBaseUrl}/documents/vectorization-progress/${documentId}?token=${token}`;
    
    eventSource = new EventSource(sseUrl);
    
    eventSource.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data);
        const percent = progress.total > 0 ? Math.floor((progress.current / progress.total) * 100) : 0;
        
        progressModal.update({
          content: (
            <div>
              <Progress 
                percent={percent} 
                status={progress.status === 'failed' ? 'exception' : progress.status === 'completed' ? 'success' : 'active'}
              />
              <div style={{ marginTop: 8, color: '#666' }}>{progress.message}</div>
            </div>
          ),
        });
        
        if (progress.status === 'completed') {
          message.success('文档向量化完成！');
          closeModal();
          loadDocuments();
        } else if (progress.status === 'failed') {
          message.error('文档向量化失败');
          closeModal();
        }
      } catch (error) {
        console.error('解析进度数据失败:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE 连接错误:', error);
      message.warning('进度监控连接失败，文档将在后台继续处理');
      closeModal();
    };
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个文档吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await documentsApi.delete(id);
          message.success('文档删除成功');
          loadDocuments();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleViewDetail = async (id: string) => {
    setLoading(true);
    try {
      const doc: any = await documentsApi.getDetail(id);
      setSelectedDocument(doc);
      setDetailModalVisible(true);
    } catch (error) {
      message.error('获取文档详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChunk = async (chunkId: string, newContent: string) => {
    try {
      await documentsApi.updateChunk(chunkId, newContent);
      message.success('文档块更新成功');
      setEditingChunk(null);
      // 重新加载文档详情
      if (selectedDocument) {
        handleViewDetail(selectedDocument.id);
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleRecallTest = async () => {
    if (!recallQuery.trim()) {
      message.warning('请输入测试查询');
      return;
    }

    setRecallLoading(true);
    try {
      const results: any = await documentsApi.search({
        query: recallQuery,
        documentIds: selectedDocument ? [selectedDocument.id] : undefined,
        topK: recallTopK,
      });
      setRecallResults(results.results || []);
      message.success(`找到 ${results.results?.length || 0} 个相关文档块`);
    } catch (error) {
      message.error('召回测试失败');
    } finally {
      setRecallLoading(false);
    }
  };

  const categories = ['未分类', '技术文档', '产品手册', '规范标准', '常见问题', '其他'];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>知识库管理</h1>
      
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Search
            placeholder="搜索文档"
            enterButton={<SearchOutlined />}
            style={{ width: 300 }}
            onSearch={setSearchText}
            allowClear
          />
          <Select
            value={categoryFilter}
            onChange={setCategoryFilter}
            style={{ width: 150 }}
            options={[
              { label: '全部分类', value: 'all' },
              ...categories.map(c => ({ label: c, value: c })),
            ]}
          />
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setUploadModalVisible(true)}
          >
            上传文档
          </Button>
          <Button icon={<SyncOutlined />} onClick={loadDocuments}>
            刷新
          </Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        <List
          dataSource={documents}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page) => setPagination(prev => ({ ...prev, page })),
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 个文档`,
          }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button 
                  type="link" 
                  icon={<EyeOutlined />}
                  onClick={() => handleViewDetail(item.id)}
                >
                  查看
                </Button>,
                <Button 
                  type="link" 
                  danger 
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(item.id)}
                >
                  删除
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={<FileTextOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                title={
                  <Space>
                    {item.title}
                    {item.vectorized ? (
                      <Tag icon={<CheckCircleOutlined />} color="success">已向量化</Tag>
                    ) : (
                      <Tag icon={<SyncOutlined spin />} color="processing">处理中</Tag>
                    )}
                  </Space>
                }
                description={
                  <Space>
                    <Tag>{item.category}</Tag>
                    <span>{(item.size / 1024).toFixed(2)} KB</span>
                    <span>{item.fileType.toUpperCase()}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Spin>

      {/* 上传对话框 */}
      <Modal
        title="上传文档"
        open={uploadModalVisible}
        onOk={handleUpload}
        onCancel={() => {
          setUploadModalVisible(false);
          setFileList([]);
          setCategory('未分类');
        }}
        okText="上传"
        cancelText="取消"
        confirmLoading={loading}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <div style={{ marginBottom: 8 }}>选择分类：</div>
            <Select
              value={category}
              onChange={setCategory}
              style={{ width: '100%' }}
              options={categories.map(c => ({ label: c, value: c }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>选择文件：</div>
            <Upload
              fileList={fileList}
              onChange={({ fileList }) => setFileList(fileList)}
              beforeUpload={() => false}
              maxCount={1}
              accept=".pdf,.txt,.doc,.docx,.md"
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              支持格式：PDF, TXT, DOC, DOCX, MD（最大50MB）
            </div>
          </div>
        </Space>
      </Modal>

      {/* 详情对话框 */}
      <Modal
        title={`文档详情 - ${selectedDocument?.title || ''}`}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedDocument(null);
          setEditingChunk(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={1000}
      >
        {selectedDocument && (
          <Tabs
            defaultActiveKey="info"
            items={[
              {
                key: 'info',
                label: '基本信息',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <div>
                      <strong>标题：</strong>{selectedDocument.title}
                    </div>
                    <div>
                      <strong>分类：</strong><Tag>{selectedDocument.category}</Tag>
                    </div>
                    <div>
                      <strong>大小：</strong>{(selectedDocument.size / 1024).toFixed(2)} KB
                    </div>
                    <div>
                      <strong>类型：</strong>{selectedDocument.fileType.toUpperCase()}
                    </div>
                    <div>
                      <strong>状态：</strong>
                      {selectedDocument.vectorized ? (
                        <Tag icon={<CheckCircleOutlined />} color="success">已向量化</Tag>
                      ) : (
                        <Tag icon={<SyncOutlined spin />} color="processing">处理中</Tag>
                      )}
                    </div>
                    <div>
                      <strong>创建时间：</strong>{new Date(selectedDocument.createdAt).toLocaleString()}
                    </div>
                    {selectedDocument.chunks && selectedDocument.chunks.length > 0 && (
                      <div>
                        <strong>文档块数：</strong>{selectedDocument.chunks.length}
                      </div>
                    )}
                    <div>
                      <strong>内容预览：</strong>
                      <div style={{ 
                        marginTop: 8, 
                        padding: 12, 
                        background: '#f5f5f5', 
                        borderRadius: 4,
                        maxHeight: 300,
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {selectedDocument.content.substring(0, 500)}
                        {selectedDocument.content.length > 500 && '...'}
                      </div>
                    </div>
                  </Space>
                ),
              },
              {
                key: 'chunks',
                label: `文档块管理 (${selectedDocument.chunks?.length || 0})`,
                children: (
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <Button 
                        type="primary" 
                        icon={<ExperimentOutlined />}
                        onClick={() => setRecallTestVisible(true)}
                      >
                        召回测试
                      </Button>
                    </div>
                    <Table
                      dataSource={selectedDocument.chunks || []}
                      rowKey="id"
                      pagination={{ pageSize: 10 }}
                      columns={[
                        {
                          title: '序号',
                          dataIndex: 'chunkIndex',
                          width: 80,
                          render: (index: number) => index + 1,
                        },
                        {
                          title: '内容',
                          dataIndex: 'content',
                          ellipsis: true,
                          render: (content: string, record: any) => {
                            if (editingChunk?.id === record.id) {
                              return (
                                <TextArea
                                  value={editingChunk.content}
                                  onChange={(e) => setEditingChunk({ ...editingChunk, content: e.target.value })}
                                  rows={4}
                                  autoSize={{ minRows: 4, maxRows: 10 }}
                                />
                              );
                            }
                            return (
                              <div style={{ 
                                maxHeight: 100, 
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap',
                              }}>
                                {content}
                              </div>
                            );
                          },
                        },
                        {
                          title: '字符数',
                          dataIndex: 'content',
                          width: 100,
                          render: (content: string) => content.length,
                        },
                        {
                          title: '操作',
                          width: 150,
                          render: (_, record: any) => {
                            if (editingChunk?.id === record.id) {
                              return (
                                <Space>
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={<SaveOutlined />}
                                    onClick={() => handleSaveChunk(record.id, editingChunk.content)}
                                  >
                                    保存
                                  </Button>
                                  <Button
                                    type="link"
                                    size="small"
                                    onClick={() => setEditingChunk(null)}
                                  >
                                    取消
                                  </Button>
                                </Space>
                              );
                            }
                            return (
                              <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => setEditingChunk({ ...record })}
                              >
                                编辑
                              </Button>
                            );
                          },
                        },
                      ]}
                    />
                  </div>
                ),
              },
            ]}
          />
        )}
      </Modal>

      {/* 召回测试对话框 */}
      <Modal
        title="召回测试"
        open={recallTestVisible}
        onCancel={() => {
          setRecallTestVisible(false);
          setRecallQuery('');
          setRecallResults([]);
        }}
        footer={[
          <Button key="close" onClick={() => setRecallTestVisible(false)}>
            关闭
          </Button>,
        ]}
        width={900}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <div style={{ marginBottom: 8 }}>测试查询：</div>
            <Input.Search
              placeholder="输入查询内容，测试文档块召回效果"
              value={recallQuery}
              onChange={(e) => setRecallQuery(e.target.value)}
              onSearch={handleRecallTest}
              enterButton="测试"
              loading={recallLoading}
            />
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>返回数量 (Top K)：</div>
            <InputNumber
              min={1}
              max={20}
              value={recallTopK}
              onChange={(value) => setRecallTopK(value || 5)}
              style={{ width: 120 }}
            />
          </div>
          {recallResults.length > 0 && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <strong>召回结果：</strong>共找到 {recallResults.length} 个相关文档块
              </div>
              <List
                dataSource={recallResults}
                renderItem={(item: any, index: number) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color="blue">#{index + 1}</Tag>
                          <span>相似度: {(item.similarity * 100).toFixed(2)}%</span>
                          <Progress 
                            percent={item.similarity * 100} 
                            size="small" 
                            style={{ width: 100 }}
                            showInfo={false}
                          />
                        </Space>
                      }
                      description={
                        <div style={{ 
                          marginTop: 8,
                          padding: 12,
                          background: '#f5f5f5',
                          borderRadius: 4,
                          whiteSpace: 'pre-wrap',
                        }}>
                          {item.content}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          )}
        </Space>
      </Modal>
    </div>
  );
};

export default KnowledgeBase;
