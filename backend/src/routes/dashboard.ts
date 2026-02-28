import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Dashboard 统计数据 API
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      totalUsers: 0,
      totalDocuments: 0,
      todayApiCalls: 0,
      avgResponseTime: 0,
      featureUsage: {
        aiChat: 0,
        documentGen: 0,
        knowledgeBase: 0,
        codeAudit: 0,
      },
      apiTrend: [],
      lastUpdated: new Date().toISOString(),
    };

    // 获取用户总数
    const userCount = await prisma.user.count();
    stats.totalUsers = userCount;

    // 获取文档总数
    const documentCount = await prisma.document.count();
    stats.totalDocuments = documentCount;

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('获取Dashboard统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      data: {
        totalUsers: 0,
        totalDocuments: 0,
        todayApiCalls: 0,
        avgResponseTime: 0,
        featureUsage: {
          aiChat: 0,
          documentGen: 0,
          knowledgeBase: 0,
          codeAudit: 0,
        },
        apiTrend: [],
        lastUpdated: new Date().toISOString(),
      },
    });
  }
});

export default router;
