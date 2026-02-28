import apiClient from './client';

export interface Document {
  id: string;
  title: string;
  category: string;
  size: number;
  fileType: string;
  vectorized: boolean;
  createdAt: string;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  category: string;
  content: string;
  similarity: number;
}

export const documentsApi = {
  // 上传文档
  upload: (file: File, category?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (category) {
      formData.append('category', category);
    }
    return apiClient.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // 获取文档列表
  list: (params?: { page?: number; pageSize?: number; search?: string; category?: string }) =>
    apiClient.get('/documents', { params }),
  
  // 搜索知识库
  search: (params: { query: string; documentIds?: string[]; topK?: number }) =>
    apiClient.post('/documents/search', params),
  
  // 删除文档
  delete: (id: string) =>
    apiClient.delete(`/documents/${id}`),
  
  // 获取文档详情
  getDetail: (id: string) =>
    apiClient.get(`/documents/${id}`),
  
  // 更新文档块
  updateChunk: (chunkId: string, content: string) =>
    apiClient.put(`/documents/chunks/${chunkId}`, { content }),
};
