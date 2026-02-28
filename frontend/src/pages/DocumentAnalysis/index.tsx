import { useState } from 'react';
import { Card, Upload, Button, List, Typography } from 'antd';
import { UploadOutlined, FileTextOutlined } from '@ant-design/icons';
import { aiApi } from '../../api/ai';

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
    <div>
      <h1 style={{ marginBottom: 24 }}>文档分析</h1>
      
      <Card style={{ marginBottom: 16 }}>
        <Upload
          beforeUpload={handleUpload}
          maxCount={1}
          accept=".pdf,.doc,.docx,.txt"
        >
          <Button icon={<UploadOutlined />} loading={analyzing}>
            上传文档
          </Button>
        </Upload>
      </Card>

      {result && (
        <Card title="分析结果" extra={<FileTextOutlined />}>
          <Paragraph>{result}</Paragraph>
        </Card>
      )}
    </div>
  );
};

export default DocumentAnalysis;
