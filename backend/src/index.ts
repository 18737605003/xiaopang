import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from './middleware/errorHandler.js';
import { operationLogMiddleware } from './middleware/logging.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import aiRoutes from './routes/ai.js';
import logRoutes from './routes/logs.js';
import documentRoutes from './routes/documents.js';
import settingsRoutes from './routes/settings.js';
import auditRoutes from './routes/audit.js';
import dashboardRoutes from './routes/dashboard.js';
import generationRoutes from './routes/generation.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 初始化 Prisma Client
const prisma = new PrismaClient();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(operationLogMiddleware);

// 数据库初始化
async function initializeDatabase() {
  try {
    console.log('🔍 检查数据库连接...');
    await prisma.$connect();
    console.log('✅ 数据库连接成功');
    return true;
  } catch (error: any) {
    console.error('❌ 数据库初始化失败:', error.message);
    console.log('');
    console.log('💡 解决方案：');
    console.log('1. 如果使用 SQLite，运行: npx prisma migrate dev --name init');
    console.log('2. 如果使用 PostgreSQL，确保数据库服务已启动');
    console.log('3. 检查 .env 文件中的 DATABASE_URL 配置');
    return false;
  }
}

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/documents', generationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: '✓ 已连接'
  });
});

app.use(errorHandler);

// 启动服务器
async function startServer() {
  await initializeDatabase();
  
  app.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    console.log('💾 数据库: 已连接');
    console.log('');
    console.log('📝 默认管理员账号：');
    console.log('   用户名: admin');
    console.log('   密码: admin123');
    console.log('========================================');
    console.log('');
  });
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n正在关闭服务器...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n正在关闭服务器...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
