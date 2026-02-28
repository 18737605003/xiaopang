import apiClient from './client';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  model?: string;
  tokens?: number;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
}

export const aiApi = {
  chat: (data: ChatRequest) =>
    apiClient.post('/ai/chat', data),
  
  analyzeDocument: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/ai/analyze-document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  generateImage: (prompt: string) =>
    apiClient.post('/ai/generate-image', { prompt }),
  
  translate: (text: string, targetLang: string) =>
    apiClient.post('/ai/translate', { text, targetLang }),
};
