import apiClient from './client';

export interface OperationLog {
  id: string;
  userId: string | null;
  username: string | null;
  action: string;
  actionLabel: string;
  resource: string;
  resourceLabel: string;
  resourceId: string | null;
  method: string;
  status: string;
  statusLabel: string;
  ip: string | null;
  userAgent: string | null;
  duration: number | null;
  details: string | null;
  createdAt: string;
}

export interface SystemLog {
  id: string;
  level: string;
  levelLabel: string;
  module: string;
  message: string;
  stack: string | null;
  metadata: string | null;
  createdAt: string;
}

export interface SecurityLog {
  id: string;
  userId: string | null;
  username: string | null;
  eventType: string;
  eventTypeLabel: string;
  ip: string | null;
  details: string | null;
  severity: string;
  severityLabel: string;
  handled: boolean;
  handledBy: string | null;
  handledAt: string | null;
  createdAt: string;
}

export interface AIUsageLog {
  id: string;
  userId: string;
  username: string | null;
  model: string;
  action: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cost: number | null;
  duration: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export interface OperationLogStatistics {
  totalLogs: number;
  todayLogs: number;
  successRate: string;
  successLogs: number;
  failureLogs: number;
  actionCounts: Array<{ action: string; label: string; count: number }>;
  resourceCounts: Array<{ resource: string; label: string; count: number }>;
  dailyStats: Array<{ date: string; count: number }>;
}

export interface SystemLogStatistics {
  totalLogs: number;
  infoLogs: number;
  warnLogs: number;
  errorLogs: number;
  moduleCounts: Array<{ module: string; count: number }>;
}

export interface SecurityLogStatistics {
  totalLogs: number;
  unhandledLogs: number;
  criticalLogs: number;
  eventTypeCounts: Array<{ eventType: string; label: string; count: number }>;
  severityCounts: Array<{ severity: string; label: string; count: number }>;
}

export interface AIUsageLogStatistics {
  totalCalls: number;
  todayCalls: number;
  successRate: string;
  successCalls: number;
  failureCalls: number;
  totalTokens: number;
  totalCost: number;
  modelCounts: Array<{ model: string; count: number; tokens: number; cost: number }>;
  actionCounts: Array<{ action: string; count: number }>;
  userCounts: Array<{ userId: string; username: string; count: number; tokens: number; cost: number }>;
}

export interface LogOptions {
  users: Array<{ id: string; username: string }>;
  models: string[];
  actions: Array<{ value: string; label: string }>;
  resources: Array<{ value: string; label: string }>;
  eventTypes: Array<{ value: string; label: string }>;
  severities: Array<{ value: string; label: string }>;
  levels: Array<{ value: string; label: string }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const logsApi = {
  getOperationLogs: async (params?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    action?: string;
    resource?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    keyword?: string;
  }): Promise<PaginatedResponse<OperationLog>> => {
    return apiClient.get('/logs/operations', { params }) as any;
  },
  
  getOperationLogStatistics: async (): Promise<OperationLogStatistics> => {
    return apiClient.get('/logs/operations/statistics') as any;
  },

  getSystemLogs: async (params?: {
    page?: number;
    pageSize?: number;
    level?: string;
    module?: string;
    startDate?: string;
    endDate?: string;
    keyword?: string;
  }): Promise<PaginatedResponse<SystemLog>> => {
    return apiClient.get('/logs/system', { params }) as any;
  },
  
  getSystemLogStatistics: async (): Promise<SystemLogStatistics> => {
    return apiClient.get('/logs/system/statistics') as any;
  },

  getSecurityLogs: async (params?: {
    page?: number;
    pageSize?: number;
    eventType?: string;
    severity?: string;
    handled?: boolean;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<SecurityLog>> => {
    return apiClient.get('/logs/security', { params }) as any;
  },
  
  getSecurityLogStatistics: async (): Promise<SecurityLogStatistics> => {
    return apiClient.get('/logs/security/statistics') as any;
  },

  handleSecurityLog: async (id: string): Promise<{ message: string; data: SecurityLog }> => {
    return apiClient.put(`/logs/security/${id}/handle`) as any;
  },

  getAIUsageLogs: async (params?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    model?: string;
    action?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<AIUsageLog>> => {
    return apiClient.get('/logs/ai-usage', { params }) as any;
  },
  
  getAIUsageLogStatistics: async (): Promise<AIUsageLogStatistics> => {
    return apiClient.get('/logs/ai-usage/statistics') as any;
  },

  getLogOptions: async (): Promise<LogOptions> => {
    return apiClient.get('/logs/options') as any;
  },

  exportLogs: async (params?: { type?: string; startDate?: string; endDate?: string }): Promise<{ type: string; headers: string[]; data: any[] }> => {
    return apiClient.get('/logs/export', { params }) as any;
  },

  clearOperationLogs: async (params?: { startDate?: string; endDate?: string }): Promise<{ message: string; count: number }> => {
    return apiClient.delete('/logs/operations/clear', { params }) as any;
  },

  clearSystemLogs: async (params?: { startDate?: string; endDate?: string }): Promise<{ message: string; count: number }> => {
    return apiClient.delete('/logs/system/clear', { params }) as any;
  },
};