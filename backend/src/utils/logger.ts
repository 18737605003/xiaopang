import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';
export type SystemModule = 'auth' | 'ai' | 'database' | 'upload' | 'system' | 'security' | 'api';
export type SecurityEventType = 
  | 'LOGIN_FAILED' 
  | 'LOGIN_SUCCESS' 
  | 'LOGOUT'
  | 'PERMISSION_DENIED' 
  | 'IP_BLOCKED' 
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'SUSPICIOUS_ACTIVITY'
  | 'PASSWORD_CHANGE'
  | 'ACCOUNT_LOCKED';
export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AIAction = 'chat' | 'embedding' | 'analysis' | 'generation' | 'rerank';

interface SystemLogParams {
  level: LogLevel;
  module: SystemModule;
  message: string;
  stack?: string;
  metadata?: Record<string, any>;
}

interface SecurityLogParams {
  userId?: string;
  eventType: SecurityEventType;
  ip?: string;
  details?: Record<string, any>;
  severity?: SecuritySeverity;
}

interface AIUsageLogParams {
  userId: string;
  username?: string;
  model: string;
  action: AIAction;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  duration: number;
  status: 'SUCCESS' | 'FAILURE';
  errorMessage?: string;
}

export const logger = {
  async info(module: SystemModule, message: string, metadata?: Record<string, any>): Promise<void> {
    await logSystem({ level: 'INFO', module, message, metadata });
  },

  async warn(module: SystemModule, message: string, metadata?: Record<string, any>): Promise<void> {
    await logSystem({ level: 'WARN', module, message, metadata });
  },

  async error(module: SystemModule, message: string, stack?: string, metadata?: Record<string, any>): Promise<void> {
    await logSystem({ level: 'ERROR', module, message, stack, metadata });
  },
};

async function logSystem(params: SystemLogParams): Promise<void> {
  try {
    await prisma.systemLog.create({
      data: {
        level: params.level,
        module: params.module,
        message: params.message,
        stack: params.stack,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (error) {
    console.error('Failed to write system log:', error);
  }
}

export async function logSecurity(params: SecurityLogParams): Promise<void> {
  try {
    await prisma.securityLog.create({
      data: {
        userId: params.userId,
        eventType: params.eventType,
        ip: params.ip,
        details: params.details ? JSON.stringify(params.details) : null,
        severity: params.severity || 'LOW',
      },
    });
  } catch (error) {
    console.error('Failed to write security log:', error);
  }
}

export async function logAIUsage(params: AIUsageLogParams): Promise<void> {
  try {
    await prisma.aIUsageLog.create({
      data: {
        userId: params.userId,
        username: params.username,
        model: params.model,
        action: params.action,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        totalTokens: params.inputTokens && params.outputTokens 
          ? params.inputTokens + params.outputTokens 
          : null,
        cost: params.cost,
        duration: params.duration,
        status: params.status,
        errorMessage: params.errorMessage,
      },
    });
  } catch (error) {
    console.error('Failed to write AI usage log:', error);
  }
}

export const ActionLabels: Record<string, string> = {
  LOGIN: '登录',
  LOGOUT: '退出',
  CREATE: '创建',
  UPDATE: '修改',
  DELETE: '删除',
  VIEW: '查看',
  EXPORT: '导出',
  UPLOAD: '上传',
  DOWNLOAD: '下载',
  AUDIT: '审计',
  CHAT: '对话',
  GENERATE: '生成',
  CONVERT: '转换',
};

export const ResourceLabels: Record<string, string> = {
  // 系统相关
  system: '系统',
  password: '密码',
  settings: '系统设置',
  
  // 用户管理
  user: '用户',
  'user-status': '用户状态',
  
  // 知识库
  knowledge: '知识库',
  
  // 文档
  document: '文档',
  
  // AI相关
  ai: 'AI',
  
  // 代码审计
  code: '代码',
  
  // 配置管理
  'api-key': 'API密钥',
  model: '模型',
  provider: '服务商',
  template: '模板',
  'kb-config': '知识库配置',
  
  // 日志
  logs: '日志',
};

export const EventTypeLabels: Record<string, string> = {
  LOGIN_FAILED: '登录失败',
  LOGIN_SUCCESS: '登录成功',
  LOGOUT: '登出',
  PERMISSION_DENIED: '权限不足',
  IP_BLOCKED: 'IP被封禁',
  TOKEN_EXPIRED: 'Token过期',
  TOKEN_INVALID: 'Token无效',
  SUSPICIOUS_ACTIVITY: '可疑活动',
  PASSWORD_CHANGE: '密码修改',
  ACCOUNT_LOCKED: '账号锁定',
};

export const SeverityLabels: Record<string, string> = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  CRITICAL: '严重',
};

export const LevelLabels: Record<string, string> = {
  INFO: '信息',
  WARN: '警告',
  ERROR: '错误',
};