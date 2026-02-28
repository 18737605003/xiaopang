import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth.js';

const prisma = new PrismaClient();

const LOG_WHITELIST = [
  'GET /api/logs',
  'GET /api/logs/options',
  'GET /api/logs/operations',
  'GET /api/logs/system',
  'GET /api/logs/statistics',
  'GET /api/logs/export',
  'GET /api/health',
  'GET /api/auth/me',
  'GET /api/settings',
  'GET /api/dashboard',
];

// 获取真实IP地址
function getRealIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (forwarded as string).split(',');
    return ips[0].trim();
  }
  return req.headers['x-real-ip'] as string ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         '未知';
}

interface LogConfig {
  action: string;
  resource: string;
  resourceIdParam?: string;
}

const ROUTE_LOG_CONFIG: Record<string, LogConfig> = {
  // 认证相关
  'POST /api/auth/login': { action: 'LOGIN', resource: 'system' },
  'POST /api/auth/logout': { action: 'LOGOUT', resource: 'system' },
  'POST /api/auth/change-password': { action: 'UPDATE', resource: 'password' },
  
  // 用户管理
  'POST /api/users/': { action: 'CREATE', resource: 'user' },
  'PUT /api/users/:id': { action: 'UPDATE', resource: 'user', resourceIdParam: 'id' },
  'DELETE /api/users/:id': { action: 'DELETE', resource: 'user', resourceIdParam: 'id' },
  'PATCH /api/users/:id/status': { action: 'UPDATE', resource: 'user-status', resourceIdParam: 'id' },
  
  // 知识库管理
  'POST /api/documents/upload': { action: 'UPLOAD', resource: 'knowledge' },
  'DELETE /api/documents/:id': { action: 'DELETE', resource: 'knowledge', resourceIdParam: 'id' },
  'PUT /api/documents/chunks/:chunkId': { action: 'UPDATE', resource: 'knowledge', resourceIdParam: 'chunkId' },
  
  // 文档生成
  'POST /api/documents/generate-from-code-stream': { action: 'GENERATE', resource: 'document' },
  'POST /api/documents/generate': { action: 'GENERATE', resource: 'document' },
  'POST /api/documents/convert-pdf': { action: 'CONVERT', resource: 'document' },
  
  // AI对话
  'POST /api/ai/chat': { action: 'CHAT', resource: 'ai' },
  'POST /api/ai/chat-stream': { action: 'CHAT', resource: 'ai' },
  
  // 代码审计
  'POST /api/audit/start': { action: 'AUDIT', resource: 'code' },
  'POST /api/audit/analyze': { action: 'AUDIT', resource: 'code' },
  
  // 系统设置
  'POST /api/settings': { action: 'UPDATE', resource: 'settings' },
  'PUT /api/settings': { action: 'UPDATE', resource: 'settings' },
  'POST /api/settings/api-keys': { action: 'CREATE', resource: 'api-key' },
  'DELETE /api/settings/api-keys/:provider/:id': { action: 'DELETE', resource: 'api-key' },
  'POST /api/settings/models': { action: 'CREATE', resource: 'model' },
  'DELETE /api/settings/models/:provider/:id': { action: 'DELETE', resource: 'model' },
  'PATCH /api/settings/providers/:provider': { action: 'UPDATE', resource: 'provider' },
  'POST /api/settings/doc-templates': { action: 'CREATE', resource: 'template' },
  'PUT /api/settings/doc-templates/:id': { action: 'UPDATE', resource: 'template', resourceIdParam: 'id' },
  'DELETE /api/settings/doc-templates/:id': { action: 'DELETE', resource: 'template', resourceIdParam: 'id' },
  'POST /api/settings/knowledge-base': { action: 'UPDATE', resource: 'kb-config' },
};

function shouldLog(req: Request): boolean {
  const routeKey = `${req.method} ${req.route?.path || req.path}`;
  for (const pattern of LOG_WHITELIST) {
    if (routeKey.startsWith(pattern.replace(':id', '').replace(':key', ''))) {
      return false;
    }
  }
  return true;
}

function getLogConfig(req: Request): LogConfig | null {
  // 获取完整路径（包括挂载点）
  const fullPath = req.baseUrl + (req.route?.path || '');
  const routeKey = `${req.method} ${fullPath}`;
  
  for (const [pattern, config] of Object.entries(ROUTE_LOG_CONFIG)) {
    const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
    if (regex.test(routeKey)) {
      return config;
    }
  }
  
  // 对于未配置的路由，不记录日志（只记录明确配置的操作）
  return null;
}

export function operationLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!shouldLog(req)) {
    return next();
  }

  const startTime = Date.now();
  const originalJson = res.json.bind(res);

  res.json = function(body: any): Response {
    const duration = Date.now() - startTime;
    const config = getLogConfig(req);
    
    if (config) {
      const authReq = req as AuthRequest;
      const status = res.statusCode >= 200 && res.statusCode < 400 ? 'SUCCESS' : 'FAILURE';
      
      const resourceId = config.resourceIdParam 
        ? req.params[config.resourceIdParam] 
        : undefined;
      
      // 生成详细描述，传入响应体以获取更多信息
      const description = generateDescription(req, config, req.body, body);

      prisma.operationLog.create({
        data: {
          userId: authReq.user?.id || null,
          username: authReq.user?.username || null,
          action: config.action,
          resource: config.resource,
          resourceId: resourceId,
          method: req.method,
          status: status,
          ip: getRealIP(req),
          userAgent: req.headers['user-agent'] || null,
          duration: duration,
          details: JSON.stringify({ 
            description: description,
            body: req.method !== 'GET' && Object.keys(req.body).length > 0 
              ? sanitizeBody(req.body) 
              : undefined 
          }),
        },
      }).catch(err => console.error('Failed to create operation log:', err));
    }

    return originalJson(body);
  };

  next();
}

function sanitizeBody(body: any): any {
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'confirmPassword', 'token', 'secret', 'apiKey', 'key'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***';
    }
  }
  
  return sanitized;
}

// 生成详细的操作描述
function generateDescription(req: Request, config: LogConfig, body: any, responseBody?: any): string {
  const { action, resource } = config;
  
  // 用户管理
  if (resource === 'user') {
    if (action === 'CREATE' && body.username) {
      return `创建用户 ${body.username}`;
    }
    if (action === 'UPDATE') {
      // 优先从请求体获取，其次从响应体获取
      const username = body.username || responseBody?.username;
      return username ? `修改用户 ${username}` : '修改用户';
    }
    if (action === 'DELETE') {
      // 从响应体中获取用户名
      const username = responseBody?.username;
      return username ? `删除用户 ${username}` : '删除用户';
    }
  }
  
  if (resource === 'user-status' && body.status !== undefined) {
    return `修改用户状态为 ${body.status === 'ACTIVE' ? '启用' : '禁用'}`;
  }
  
  // 知识库管理
  if (resource === 'knowledge') {
    if (action === 'UPLOAD') {
      // 从响应体中获取文档标题
      const title = responseBody?.title;
      return title ? `上传知识库文档《${title}》` : '上传知识库文档';
    }
    if (action === 'DELETE') {
      return `删除知识库文档`;
    }
    if (action === 'UPDATE') {
      return `修改知识库文档`;
    }
  }
  
  // 文档生成
  if (resource === 'document') {
    if (action === 'GENERATE' && body.title) {
      return `生成文档《${body.title}》`;
    }
    if (action === 'CONVERT' && body.title) {
      return `转换文档《${body.title}》为PDF`;
    }
  }
  
  // 系统设置
  if (resource === 'settings') {
    return '保存系统配置';
  }
  
  if (resource === 'api-key') {
    if (action === 'CREATE') {
      return '添加API密钥';
    }
    if (action === 'DELETE') {
      return '删除API密钥';
    }
  }
  
  if (resource === 'model') {
    if (action === 'CREATE' && body.name) {
      return `添加模型 ${body.name}`;
    }
    if (action === 'DELETE') {
      return '删除模型';
    }
  }
  
  if (resource === 'template') {
    if (action === 'CREATE' && body.name) {
      return `创建文档模板《${body.name}》`;
    }
    if (action === 'UPDATE' && body.name) {
      return `修改文档模板《${body.name}》`;
    }
    if (action === 'DELETE') {
      return '删除文档模板';
    }
  }
  
  if (resource === 'kb-config') {
    return '保存知识库配置';
  }
  
  // AI对话
  if (resource === 'ai' && action === 'CHAT') {
    return 'AI对话交互';
  }
  
  // 代码审计
  if (resource === 'code' && action === 'AUDIT') {
    if (body.filePath) {
      return `代码审计：${body.filePath}`;
    }
    return '代码审计';
  }
  
  // 认证相关
  if (resource === 'system') {
    if (action === 'LOGIN') {
      return '登录系统';
    }
    if (action === 'LOGOUT') {
      return '退出系统';
    }
  }
  
  if (resource === 'password') {
    return '修改密码';
  }
  
  // 默认描述
  const actionMap: Record<string, string> = {
    CREATE: '创建',
    UPDATE: '修改',
    DELETE: '删除',
    UPLOAD: '上传',
    GENERATE: '生成',
    CONVERT: '转换',
    CHAT: '对话',
    AUDIT: '审计',
    LOGIN: '登录',
    LOGOUT: '退出',
  };
  
  const resourceMap: Record<string, string> = {
    user: '用户',
    knowledge: '知识库',
    document: '文档',
    settings: '系统设置',
    'api-key': 'API密钥',
    model: '模型',
    template: '模板',
    ai: 'AI',
    code: '代码',
    system: '系统',
    password: '密码',
  };
  
  return `${actionMap[action] || action} ${resourceMap[resource] || resource}`;
}

export async function logOperation(params: {
  userId?: string;
  username?: string;
  action: string;
  resource: string;
  resourceId?: string;
  method?: string;
  status: 'SUCCESS' | 'FAILURE';
  ip?: string;
  userAgent?: string;
  duration?: number;
  details?: Record<string, any>;
}): Promise<void> {
  try {
    await prisma.operationLog.create({
      data: {
        userId: params.userId || null,
        username: params.username || null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        method: params.method || 'SYSTEM',
        status: params.status,
        ip: params.ip || null,
        userAgent: params.userAgent || null,
        duration: params.duration || null,
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  } catch (error) {
    console.error('Failed to write operation log:', error);
  }
}
