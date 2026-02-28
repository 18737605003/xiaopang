import express from 'express';
import { PrismaClient } from '@prisma/client';
import {
  isValidGitUrl,
  extractRepoName,
  getBranches,
  processAudit,
  getAuditProgress,
} from '../services/auditService.js';

const router = express.Router();
const prisma = new PrismaClient();

// 获取仓库分支列表
router.get('/branches', async (req, res) => {
  try {
    const { repoUrl, token } = req.query;
    
    if (!repoUrl || typeof repoUrl !== 'string') {
      return res.status(400).json({ message: '请提供仓库 URL' });
    }
    
    // 验证 URL
    if (!isValidGitUrl(repoUrl)) {
      return res.status(400).json({ message: '无效的 Git 仓库 URL' });
    }
    
    const branches = await getBranches(repoUrl, token as string | undefined);
    
    res.json({
      branches,
      defaultBranch: branches.includes('main') ? 'main' : branches.includes('master') ? 'master' : branches[0],
    });
  } catch (error: any) {
    console.error('获取分支列表错误:', error);
    res.status(500).json({ message: error.message || '获取分支列表失败' });
  }
});

// 提交审计任务
router.post('/submit', async (req, res) => {
  try {
    const { repoUrl, branch } = req.body;
    
    // 验证 URL
    if (!isValidGitUrl(repoUrl)) {
      return res.status(400).json({ 
        message: '无效的 Git 仓库 URL。支持格式：\n' +
                 '- HTTPS: https://github.com/user/repo\n' +
                 '- HTTPS: https://gitlab.com/user/repo\n' +
                 '- SSH: git@github.com:user/repo.git\n' +
                 '- 自建服务: https://git.company.com/user/repo'
      });
    }
    
    // 获取第一个用户（简化版）
    const firstUser = await prisma.user.findFirst();
    if (!firstUser) {
      return res.status(500).json({ message: '系统错误：未找到用户' });
    }
    
    // 创建任务
    const task = await prisma.auditTask.create({
      data: {
        userId: firstUser.id,
        repoUrl,
        repoName: extractRepoName(repoUrl),
        branch: branch || 'main',
        status: 'pending',
        progress: 0,
        message: '等待开始...',
      },
    });
    
    console.log(`📋 创建审计任务: ${task.repoName} (ID: ${task.id})`);
    
    // 异步处理审计
    processAudit(task.id).catch(console.error);
    
    res.json({
      message: '审计任务已创建',
      taskId: task.id,
    });
  } catch (error: any) {
    console.error('创建审计任务错误:', error);
    res.status(500).json({ message: error.message || '创建任务失败' });
  }
});

// SSE 端点：获取审计进度
router.get('/progress/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  
  // 发送进度
  const sendProgress = () => {
    const progress = getAuditProgress(taskId);
    res.write(`data: ${JSON.stringify(progress)}\n\n`);
    
    // 如果已完成或失败，关闭连接
    if (progress.status === 'completed' || progress.status === 'failed') {
      res.end();
      return false;
    }
    return true;
  };
  
  // 立即发送一次
  if (!sendProgress()) {
    return;
  }
  
  // 每秒发送一次进度更新
  const interval = setInterval(() => {
    if (!sendProgress()) {
      clearInterval(interval);
    }
  }, 1000);
  
  // 客户端断开连接时清理
  req.on('close', () => {
    clearInterval(interval);
  });
});

// 获取审计报告
router.get('/report/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = await prisma.auditTask.findUnique({
      where: { id: taskId },
      include: { report: true },
    });
    
    if (!task) {
      return res.status(404).json({ message: '任务不存在' });
    }
    
    if (!task.report) {
      return res.status(404).json({ message: '报告尚未生成' });
    }
    
    res.json({
      task: {
        id: task.id,
        repoName: task.repoName,
        repoUrl: task.repoUrl,
        branch: task.branch,
        status: task.status,
        startTime: task.startTime,
        endTime: task.endTime,
      },
      report: {
        ...task.report,
        issues: JSON.parse(task.report.issues),
        metrics: JSON.parse(task.report.metrics),
      },
    });
  } catch (error: any) {
    console.error('获取报告错误:', error);
    res.status(500).json({ message: '获取报告失败' });
  }
});

// 获取审计任务列表
router.get('/tasks', async (req, res) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;
    
    const tasks = await prisma.auditTask.findMany({
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      orderBy: { createdAt: 'desc' },
      include: {
        report: {
          select: {
            totalIssues: true,
            criticalIssues: true,
            highIssues: true,
          },
        },
      },
    });
    
    const total = await prisma.auditTask.count();
    
    res.json({
      data: tasks,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (error: any) {
    console.error('获取任务列表错误:', error);
    res.status(500).json({ message: '获取任务列表失败' });
  }
});

// 删除审计任务
router.delete('/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    await prisma.auditTask.delete({
      where: { id: taskId },
    });
    
    res.json({ message: '任务删除成功' });
  } catch (error: any) {
    console.error('删除任务错误:', error);
    res.status(500).json({ message: '删除任务失败' });
  }
});

export default router;
