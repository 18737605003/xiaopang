import apiClient from './client';

export interface AuditTask {
  id: string;
  repoName: string;
  repoUrl: string;
  branch: string;
  status: string;
  progress: number;
  message?: string;
  startTime: string;
  endTime?: string;
}

export interface AuditReport {
  task: AuditTask;
  report: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    filesScanned: number;
    linesOfCode: number;
    issues: Issue[];
    metrics: CodeMetrics;
    aiInsights: string;
  };
}

export interface Issue {
  type: 'security' | 'quality' | 'best-practice';
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  file: string;
  line: number;
  code: string;
  suggestion: string;
  cwe?: string;
}

export interface CodeMetrics {
  totalFiles: number;
  totalLines: number;
  filesByType: Record<string, number>;
  filesByLanguage: Record<string, number>;
}

export const auditApi = {
  // 提交审计任务
  submit: (data: { repoUrl: string; branch?: string }) =>
    apiClient.post('/audit/submit', data),
  
  // 获取审计报告
  getReport: (taskId: string): Promise<AuditReport> =>
    apiClient.get(`/audit/report/${taskId}`),
  
  // 获取任务列表
  getTasks: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get('/audit/tasks', { params }),
  
  // 删除任务
  deleteTask: (taskId: string) =>
    apiClient.delete(`/audit/tasks/${taskId}`),
  
  // 获取仓库分支列表
  getBranches: (repoUrl: string, token?: string): Promise<{ branches: string[]; defaultBranch: string }> =>
    apiClient.get('/audit/branches', { params: { repoUrl, token } }),
};
