import { useState } from 'react';
import { Card, Upload, Button, Typography, Empty } from 'antd';
import { UploadOutlined, FileTextOutlined, InboxOutlined } from '@ant-design/icons';
import { aiApi } from '../../api/ai';
import PageHeader from '../../components/PageHeader';

const { Paragraph } = Typography;

const DocumentAnalysis = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleUpload = async (file: File) => {
    setAnalyzing(true);
    try {
      const response = await aiApi.analyzeDocument(file);
      setResult(response.analysis);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setAnalyzing(false);
    }
    return false;
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader
        title="文档分析"
        description="上传文档，AI 自动分析内容并提取关键信息"
      />
      
      <Card style={{ marginBottom: 16 }}>
        <Upload.Dragger
          beforeUpload={handleUpload}
          maxCount={1}
          accept=".pdf,.doc,.docx,.txt"
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持 PDF、Word、TXT 格式</p>
        </Upload.Dragger>
      </Card>

      {result ? (
        <Card title="分析结果" extra={<FileTextOutlined />}>
          <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{result}</Paragraph>
        </Card>
      ) : !analyzing && (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="上传文档后，分析结果将显示在这里"
          />
        </Card>
      )}
    </div>
  );
};

export default DocumentAnalysis;
