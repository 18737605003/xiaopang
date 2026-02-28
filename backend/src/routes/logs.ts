import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authenticate, authorize } from '../middleware/auth.js';
import { 
  ActionLabels, 
  ResourceLabels, 
  LevelLabels 
} from '../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(authorize('ADMIN'));

// 获取真实IP地址
function getRealIP(req: any): string {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         '未知';
}

// 清除操作日志
router.delete('/operations/clear', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where: any = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    
    const result = await prisma.operationLog.deleteMany({ where });
    
    res.json({ 
      message: `成功清除 ${result.count} 条操作日志`,
      count: result.count 
    });
  } catch (error) {
    console.error('清除操作日志失败:', error);
    res.status(500).json({ message: '清除操作日志失败' });
  }
});

// 清除系统日志
router.delete('/system/clear', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where: any = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    
    const result = await prisma.systemLog.deleteMany({ where });
    
    res.json({ 
      message: `成功清除 ${result.count} 条系统日志`,
      count: result.count 
    });
  } catch (error) {
    console.error('清除系统日志失败:', error);
    res.status(500).json({ message: '清除系统日志失败' });
  }
});

router.get('/operations', async (req: AuthRequest, res: Response) => {
  try {
    const { 
      page = 1, 
      pageSize = 20, 
      userId, 
      action, 
      resource, 
      status,
      startDate, 
      endDate,
      keyword 
    } = req.query;

    const where: any = {};
    
    if (userId) where.userId = userId as string;
    if (action) where.action = action as string;
    if (resource) where.resource = resource as string;
    if (status) where.status = status as string;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    
    if (keyword) {
      where.OR = [
        { username: { contains: keyword as string } },
        { resource: { contains: keyword as string } },
        { ip: { contains: keyword as string } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.operationLog.findMany({
        where,
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.operationLog.count({ where }),
    ]);

    const formattedLogs = logs.map(log => {
      const actionLabel = ActionLabels[log.action] || log.action;
      const resourceLabel = ResourceLabels[log.resource] || log.resource;
      
      return {
        ...log,
        actionLabel,
        resourceLabel,
        operationDesc: `${actionLabel}${resourceLabel}`,
        statusLabel: log.status === 'SUCCESS' ? '成功' : '失败',
      };
    });

    res.json({ 
      data: formattedLogs, 
      total, 
      page: Number(page), 
      pageSize: Number(pageSize) 
    });
  } catch (error) {
    console.error('获取操作日志失败:', error);
    res.status(500).json({ message: '获取操作日志失败' });
  }
});

router.get('/operations/statistics', async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      totalLogs,
      todayLogs,
      successLogs,
      failureLogs,
      actionCounts,
      resourceCounts,
    ] = await Promise.all([
      prisma.operationLog.count(),
      prisma.operationLog.count({ where: { createdAt: { gte: today } } }),
      prisma.operationLog.count({ where: { status: 'SUCCESS' } }),
      prisma.operationLog.count({ where: { status: 'FAILURE' } }),
      prisma.operationLog.groupBy({
        by: ['action'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.operationLog.groupBy({
        by: ['resource'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    const dailyStats = await prisma.$queryRaw`
      SELECT date(createdAt) as date, COUNT(*) as count
      FROM OperationLog
      WHERE createdAt >= datetime('now', '-7 days')
      GROUP BY date(createdAt)
      ORDER BY date DESC
    ` as any[];

    res.json({
      totalLogs,
      todayLogs,
      successRate: totalLogs > 0 ? ((successLogs / totalLogs) * 100).toFixed(1) : 0,
      successLogs,
      failureLogs,
      actionCounts: actionCounts.map(a => ({
        action: a.action,
        label: ActionLabels[a.action] || a.action,
        count: a._count.id,
      })),
      resourceCounts: resourceCounts.map(r => ({
        resource: r.resource,
        label: ResourceLabels[r.resource] || r.resource,
        count: r._count.id,
      })),
      dailyStats: dailyStats.map(d => ({
        date: d.date,
        count: d.count,
      })),
    });
  } catch (error) {
    console.error('获取操作日志统计失败:', error);
    res.status(500).json({ message: '获取统计数据失败' });
  }
});

router.get('/system', async (req: AuthRequest, res: Response) => {
  try {
    const { 
      page = 1, 
      pageSize = 20, 
      level, 
      module, 
      startDate, 
      endDate,
      keyword 
    } = req.query;

    const where: any = {};
    
    if (level) where.level = level as string;
    if (module) where.module = module as string;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    
    if (keyword) {
      where.message = { contains: keyword as string };
    }

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.systemLog.count({ where }),
    ]);

    const formattedLogs = logs.map(log => ({
      ...log,
      levelLabel: LevelLabels[log.level] || log.level,
    }));

    res.json({ 
      data: formattedLogs, 
      total, 
      page: Number(page), 
      pageSize: Number(pageSize) 
    });
  } catch (error) {
    console.error('获取系统日志失败:', error);
    res.status(500).json({ message: '获取系统日志失败' });
  }
});

router.get('/system/statistics', async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalLogs,
      infoLogs,
      warnLogs,
      errorLogs,
      moduleCounts,
    ] = await Promise.all([
      prisma.systemLog.count(),
      prisma.systemLog.count({ where: { level: 'INFO' } }),
      prisma.systemLog.count({ where: { level: 'WARN' } }),
      prisma.systemLog.count({ where: { level: 'ERROR' } }),
      prisma.systemLog.groupBy({
        by: ['module'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    res.json({
      totalLogs,
      infoLogs,
      warnLogs,
      errorLogs,
      moduleCounts: moduleCounts.map(m => ({
        module: m.module,
        count: m._count.id,
      })),
    });
  } catch (error) {
    console.error('获取系统日志统计失败:', error);
    res.status(500).json({ message: '获取统计数据失败' });
  }
});

// 导出日志
router.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const { type = 'operation', startDate, endDate } = req.query;
    
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.lte = end;
      }
    }

    let data: any[] = [];
    let headers: string[] = [];

    switch (type) {
      case 'operation':
        data = await prisma.operationLog.findMany({
          where: dateFilter,
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });
        headers = ['ID', '用户', '操作描述', '方法', '状态', 'IP地址', '耗时(ms)', '时间'];
        data = data.map(log => ({
          id: log.id,
          username: log.username || '系统',
          operation: `${ActionLabels[log.action] || log.action}${ResourceLabels[log.resource] || log.resource}`,
          method: log.method,
          status: log.status === 'SUCCESS' ? '成功' : '失败',
          ip: log.ip || '未知',
          duration: log.duration || 0,
          createdAt: log.createdAt.toISOString(),
        }));
        break;
      case 'system':
        data = await prisma.systemLog.findMany({
          where: dateFilter,
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });
        headers = ['ID', '级别', '模块', '消息', '时间'];
        data = data.map(log => ({
          id: log.id,
          level: LevelLabels[log.level] || log.level,
          module: log.module,
          message: log.message,
          createdAt: log.createdAt.toISOString(),
        }));
        break;
    }

    res.json({
      type,
      headers,
      data,
    });
  } catch (error) {
    console.error('导出日志失败:', error);
    res.status(500).json({ message: '导出失败' });
  }
});

// 获取筛选选项
router.get('/options', async (req: AuthRequest, res: Response) => {
  try {
    const [users, actions, resources] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, username: true },
        orderBy: { username: 'asc' },
      }),
      prisma.operationLog.findMany({
        select: { action: true },
        distinct: ['action'],
      }),
      prisma.operationLog.findMany({
        select: { resource: true },
        distinct: ['resource'],
      }),
    ]);

    res.json({
      users,
      actions: actions.map(a => ({ 
        value: a.action, 
        label: ActionLabels[a.action] || a.action 
      })),
      resources: resources.map(r => ({ 
        value: r.resource, 
        label: ResourceLabels[r.resource] || r.resource 
      })),
      levels: Object.entries(LevelLabels).map(([value, label]) => ({ value, label })),
    });
  } catch (error) {
    console.error('获取选项失败:', error);
    res.status(500).json({ message: '获取选项失败' });
  }
});

export default router;

