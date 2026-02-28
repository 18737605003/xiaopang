import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// SSE 端点不需要认证（因为 EventSource 不支持自定义 headers）
// 但我们可以通过 URL 参数验证 token
router.get('/vectorization-progress/:documentId', (req, res) => {
  const { documentId } = req.params;
  
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  
  // 发送初始进度
  const sendProgress = () => {
    const progress = vectorizationProgress.get(documentId);
    if (progress) {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
      
      // 如果已完成或失败，关闭连接
      if (progress.status === 'completed' || progress.status === 'failed') {
        res.end();
        return false;
      }
    } else {
      // 没有进度信息，可能还未开始或已完成
      res.write(`data: ${JSON.stringify({ total: 0, current: 0, status: 'processing', message: '等待开始...' })}\n\n`);
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

// 所有其他文档路由都需要认证
router.use(authenticate);

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 解决中文文件名乱码问题
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(originalName);
    const basename = path.basename(originalName, ext);
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.doc', '.docx', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// 文本分块函数 - 改进版，支持重叠
function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[。！？\n]+/).filter(s => s.trim());
  
  let currentChunk = '';
  let previousChunk = '';
  
  for (const sentence of sentences) {
    const sentenceWithPunc = sentence + '。';
    
    if ((currentChunk + sentenceWithPunc).length > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      
      // 添加重叠：保留上一块的最后部分
      if (overlap > 0 && currentChunk.length > overlap) {
        previousChunk = currentChunk.slice(-overlap);
        currentChunk = previousChunk + sentenceWithPunc;
      } else {
        currentChunk = sentenceWithPunc;
      }
    } else {
      currentChunk += sentenceWithPunc;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// 使用Fireworks AI Embedding进行向量化
async function vectorizeWithFireworks(text: string, apiKey: string, model: string): Promise<number[]> {
  try {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('https://api.fireworks.ai/inference/v1/embeddings', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        input: text,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Embedding API 调用失败: ${response.statusText}`);
    }
    
    const data: any = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Fireworks embedding 错误:', error);
    // 降级到简单向量化
    return simpleVectorize(text);
  }
}

// 简单的向量化函数（备用方案）
function simpleVectorize(text: string): number[] {
  const vector = new Array(384).fill(0);
  for (let i = 0; i < text.length && i < 384; i++) {
    vector[i] = text.charCodeAt(i) / 65535;
  }
  return vector;
}

// 余弦相似度计算
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// 进度跟踪存储
const vectorizationProgress = new Map<string, {
  total: number;
  current: number;
  status: 'processing' | 'completed' | 'failed';
  message: string;
}>();

// 更新进度
function updateProgress(documentId: string, current: number, total: number, message: string) {
  vectorizationProgress.set(documentId, {
    total,
    current,
    status: 'processing',
    message,
  });
}

// 完成进度
function completeProgress(documentId: string, success: boolean, message: string) {
  const progress = vectorizationProgress.get(documentId);
  if (progress) {
    vectorizationProgress.set(documentId, {
      ...progress,
      status: success ? 'completed' : 'failed',
      message,
    });
    
    // 5分钟后清理进度数据
    setTimeout(() => {
      vectorizationProgress.delete(documentId);
    }, 5 * 60 * 1000);
  }
}



// 上传文档
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请选择文件' });
    }
    
    const { category } = req.body;
    // 从认证中间件获取用户信息
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: '未授权' });
    }
    
    // 解决文件名乱码
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    
    let content = '';
    const ext = path.extname(originalName).toLowerCase();
    
    // 解析文件内容
    try {
      if (ext === '.txt' || ext === '.md') {
        content = fs.readFileSync(req.file.path, 'utf-8');
      } else if (ext === '.pdf') {
        const pdfParse = (await import('pdf-parse')).default;
        const dataBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdfParse(dataBuffer);
        content = pdfData.text;
      } else if (ext === '.docx') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ path: req.file.path });
        content = result.value;
      } else if (ext === '.doc') {
        // DOC 格式较老，暂不支持
        content = `[DOC文档] ${originalName}\n\n旧版DOC格式暂不支持自动解析，请转换为DOCX格式后重新上传。`;
      } else {
        content = `[${ext.toUpperCase()}文档] ${originalName}\n\n此文档类型暂不支持自动解析。`;
      }
    } catch (parseError) {
      console.error('文档解析错误:', parseError);
      content = `文档解析失败，但文件已保存。文件名：${originalName}`;
    }
    
    // 创建文档记录
    const document = await prisma.document.create({
      data: {
        userId,
        title: originalName,
        content,
        category: category || '未分类',
        size: req.file.size,
        fileType: ext.substring(1),
        filePath: req.file.path,
        vectorized: false,
      },
    });
    
    // 初始化进度
    vectorizationProgress.set(document.id, {
      total: 0,
      current: 0,
      status: 'processing',
      message: '准备开始向量化...',
    });
    
    // 异步向量化处理
    processVectorization(document.id, content).catch(console.error);
    
    res.json({
      message: '文档上传成功，正在进行向量化处理',
      documentId: document.id,
      title: originalName, // 返回文档标题供日志使用
    });
  } catch (error: any) {
    console.error('文档上传错误:', error);
    res.status(500).json({ message: error.message || '文档上传失败' });
  }
});

// 向量化处理（优化版：并发批处理 + 进度跟踪）
async function processVectorization(documentId: string, content: string) {
  try {
    console.log(`📊 开始向量化文档: ${documentId}`);
    const startTime = Date.now();
    
    // 获取系统配置
    const config = await getSystemConfig();
    const useEmbeddingAPI = config.apiKey && config.knowledgeBase.embeddingModel;
    
    // 数据清洗
    updateProgress(documentId, 0, 100, '正在清洗文档内容...');
    const cleanedContent = cleanText(content);
    
    // 分块（使用配置的参数）
    updateProgress(documentId, 10, 100, '正在分块处理...');
    const chunks = chunkText(
      cleanedContent,
      config.knowledgeBase.chunkSize,
      config.knowledgeBase.chunkOverlap
    );
    console.log(`📝 文档分为 ${chunks.length} 个块 (大小:${config.knowledgeBase.chunkSize}, 重叠:${config.knowledgeBase.chunkOverlap})`);
    
    if (useEmbeddingAPI) {
      // 使用并发批处理向量化
      await processVectorizationConcurrent(documentId, chunks, config);
    } else {
      // 简单向量化（快速，无需并发）
      await processVectorizationSimple(documentId, chunks);
    }
    
    // 更新文档状态
    updateProgress(documentId, 95, 100, '正在保存文档状态...');
    await prisma.document.update({
      where: { id: documentId },
      data: { vectorized: true },
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ 文档向量化完成: ${documentId} (${chunks.length}个块, 耗时: ${duration}秒, 方法: ${useEmbeddingAPI ? 'Fireworks AI (并发)' : '简单向量化'})`);
    
    completeProgress(documentId, true, `向量化完成！共处理 ${chunks.length} 个文档块，耗时 ${duration} 秒`);
  } catch (error) {
    console.error('❌ 向量化处理错误:', error);
    completeProgress(documentId, false, `向量化失败: ${error instanceof Error ? error.message : '未知错误'}`);
    
    // 标记文档向量化失败
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: { vectorized: false },
      });
    } catch (e) {
      console.error('更新文档状态失败:', e);
    }
  }
}

// 并发批处理向量化（带进度跟踪）
async function processVectorizationConcurrent(
  documentId: string, 
  chunks: string[], 
  config: any
) {
  const BATCH_SIZE = 5; // 每批处理5个块（降低批大小）
  const CONCURRENT_LIMIT = 2; // 同时最多2个并发请求（降低并发数）
  const DELAY_BETWEEN_BATCHES = 1000; // 批次间延迟1秒
  const DELAY_BETWEEN_REQUESTS = 500; // 请求间延迟500ms
  
  console.log(`🚀 使用并发批处理 (批大小:${BATCH_SIZE}, 并发数:${CONCURRENT_LIMIT})`);
  
  let processedCount = 0;
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
  
  // 分批处理
  for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
    const batch = chunks.slice(batchStart, batchEnd);
    const currentBatch = Math.floor(batchStart / BATCH_SIZE) + 1;
    
    updateProgress(
      documentId, 
      20 + Math.floor((processedCount / chunks.length) * 70), 
      100, 
      `正在向量化第 ${currentBatch}/${totalBatches} 批 (${processedCount}/${chunks.length} 块)`
    );
    
    console.log(`📦 处理批次 ${currentBatch}/${totalBatches} (块 ${batchStart + 1}-${batchEnd})`);
    
    // 将批次分成更小的并发组
    const results: Array<{ index: number; embedding: number[]; content: string }> = [];
    
    for (let i = 0; i < batch.length; i += CONCURRENT_LIMIT) {
      const concurrentGroup = batch.slice(i, Math.min(i + CONCURRENT_LIMIT, batch.length));
      const concurrentStartIndex = batchStart + i;
      
      // 并发处理这一组
      const promises = concurrentGroup.map(async (chunk, idx) => {
        const globalIndex = concurrentStartIndex + idx;
        try {
          // 添加重试机制
          let retries = 3;
          let lastError;
          
          while (retries > 0) {
            try {
              const embedding = await vectorizeWithFireworks(
                chunk,
                config.apiKey!,
                config.knowledgeBase.embeddingModel
              );
              return { index: globalIndex, embedding, content: chunk };
            } catch (error: any) {
              lastError = error;
              if (error.message?.includes('Too Many Requests') && retries > 1) {
                console.log(`⏳ 遇到速率限制，等待 ${retries * 2} 秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, retries * 2000));
                retries--;
              } else {
                break;
              }
            }
          }
          
          throw lastError;
        } catch (error) {
          console.error(`❌ 块 ${globalIndex + 1} 向量化失败:`, error);
          // 降级到简单向量化
          const embedding = simpleVectorize(chunk);
          return { index: globalIndex, embedding, content: chunk };
        }
      });
      
      const groupResults = await Promise.all(promises);
      results.push(...groupResults);
      processedCount += groupResults.length;
      
      // 更新进度
      updateProgress(
        documentId, 
        20 + Math.floor((processedCount / chunks.length) * 70), 
        100, 
        `正在向量化第 ${currentBatch}/${totalBatches} 批 (${processedCount}/${chunks.length} 块)`
      );
      
      // 请求间延迟，避免API限流
      if (i + CONCURRENT_LIMIT < batch.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }
    }
    
    // 批量插入数据库
    await prisma.documentChunk.createMany({
      data: results.map(r => ({
        documentId,
        content: r.content,
        embedding: JSON.stringify(r.embedding),
        chunkIndex: r.index,
      })),
    });
    
    // 批次间延迟
    if (batchStart + BATCH_SIZE < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
}

// 简单向量化处理（无需并发，带进度跟踪）
async function processVectorizationSimple(documentId: string, chunks: string[]) {
  console.log(`⚡ 使用简单向量化 (快速模式)`);
  
  updateProgress(documentId, 20, 100, '正在快速向量化...');
  
  const data = chunks.map((chunk, index) => ({
    documentId,
    content: chunk,
    embedding: JSON.stringify(simpleVectorize(chunk)),
    chunkIndex: index,
  }));
  
  updateProgress(documentId, 80, 100, '正在保存到数据库...');
  
  // 批量插入
  await prisma.documentChunk.createMany({ data });
  
  console.log(`✅ 已保存 ${chunks.length} 个块到数据库`);
}

// 数据清洗函数
function cleanText(text: string): string {
  let cleaned = text;
  
  // 1. 移除多余的空白字符
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // 2. 移除特殊字符（保留中文、英文、数字、常用标点）
  cleaned = cleaned.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s，。！？、；：""''（）《》【】\-_.,!?;:()"'\[\]]/g, '');
  
  // 3. 规范化标点符号
  cleaned = cleaned.replace(/[,，]/g, '，');
  cleaned = cleaned.replace(/[.。]/g, '。');
  cleaned = cleaned.replace(/[!！]/g, '！');
  cleaned = cleaned.replace(/[?？]/g, '？');
  
  // 4. 移除重复的标点
  cleaned = cleaned.replace(/([，。！？])\1+/g, '$1');
  
  // 5. 移除首尾空白
  cleaned = cleaned.trim();
  
  return cleaned;
}

// 获取系统配置
async function getSystemConfig(): Promise<{
  apiKey: string | null;
  knowledgeBase: {
    embeddingModel: string;
    rerankerModel: string;
    useReranker: boolean;
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    rerankTopN: number;
  };
}> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const configPath = path.join(process.cwd(), 'data', 'system-config.json');
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      // 获取当前选中的provider和API key
      const provider = config.providers?.[config.selectedProvider];
      const selectedApiKey = provider?.apiKeys?.find((k: any) => k.id === config.selectedApiKey);
      
      return {
        apiKey: selectedApiKey?.key || null,
        knowledgeBase: config.knowledgeBase || {
          embeddingModel: 'accounts/fireworks/models/qwen3-embedding-8b',
          rerankerModel: 'accounts/fireworks/models/qwen3-reranker-8b',
          useReranker: true,
          chunkSize: 500,
          chunkOverlap: 50,
          topK: 5,
          rerankTopN: 3,
        },
      };
    }
  } catch (error) {
    console.error('读取系统配置失败:', error);
  }
  
  return {
    apiKey: null,
    knowledgeBase: {
      embeddingModel: 'accounts/fireworks/models/qwen3-embedding-8b',
      rerankerModel: 'accounts/fireworks/models/qwen3-reranker-8b',
      useReranker: true,
      chunkSize: 500,
      chunkOverlap: 50,
      topK: 5,
      rerankTopN: 3,
    },
  };
}

// 获取文档列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, search, category } = req.query;
    
    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { content: { contains: search as string } },
      ];
    }
    if (category && category !== 'all') {
      where.category = category;
    }
    
    const documents = await prisma.document.findMany({
      where,
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        category: true,
        size: true,
        fileType: true,
        vectorized: true,
        createdAt: true,
      },
    });
    
    const total = await prisma.document.count({ where });
    
    res.json({
      data: documents,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (error: any) {
    console.error('获取文档列表错误:', error);
    res.status(500).json({ message: '获取文档列表失败' });
  }
});

// 搜索知识库
router.post('/search', async (req, res) => {
  try {
    const { query, documentIds, topK = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ message: '请提供搜索查询' });
    }
    
    console.log(`🔍 搜索知识库: "${query}"`);
    const searchStartTime = Date.now();
    
    // 获取系统配置
    const config = await getSystemConfig();
    const useEmbeddingAPI = config.apiKey && config.knowledgeBase.embeddingModel;
    
    // 使用配置的向量化方法
    let queryVector: number[];
    if (useEmbeddingAPI) {
      console.log(`🔄 使用 ${config.knowledgeBase.embeddingModel} 向量化查询`);
      queryVector = await vectorizeWithFireworks(
        query,
        config.apiKey!,
        config.knowledgeBase.embeddingModel
      );
    } else {
      console.log(`⚠️  使用简单向量化（建议配置 Embedding API）`);
      queryVector = simpleVectorize(query);
    }
    console.log(`⚡ 向量化完成 (${Date.now() - searchStartTime}ms)`);
    
    // 获取文档块
    const where: any = {};
    if (documentIds && documentIds.length > 0) {
      where.documentId = { in: documentIds };
    }
    
    const chunks = await prisma.documentChunk.findMany({
      where,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
      },
    });
    
    // 计算相似度
    const results = chunks.map(chunk => {
      const embedding = JSON.parse(chunk.embedding);
      const similarity = cosineSimilarity(queryVector, embedding);
      return {
        chunkId: chunk.id,
        documentId: chunk.documentId,
        documentTitle: chunk.document.title,
        category: chunk.document.category,
        content: chunk.content,
        similarity,
      };
    });
    
    // 排序并返回top K
    results.sort((a, b) => b.similarity - a.similarity);
    const topResults = results.slice(0, topK);
    
    res.json({
      results: topResults,
      total: results.length,
    });
  } catch (error: any) {
    console.error('知识库搜索错误:', error);
    res.status(500).json({ message: '搜索失败' });
  }
});

// 删除文档
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await prisma.document.findUnique({
      where: { id },
    });
    
    if (!document) {
      return res.status(404).json({ message: '文档不存在' });
    }
    
    // 删除文件
    if (document.filePath && fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }
    
    // 删除数据库记录（会级联删除chunks）
    await prisma.document.delete({
      where: { id },
    });
    
    res.json({ message: '文档删除成功' });
  } catch (error: any) {
    console.error('删除文档错误:', error);
    res.status(500).json({ message: '删除文档失败' });
  }
});

// 获取文档详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        chunks: {
          select: {
            id: true,
            content: true,
            chunkIndex: true,
          },
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });
    
    if (!document) {
      return res.status(404).json({ message: '文档不存在' });
    }
    
    res.json(document);
  } catch (error: any) {
    console.error('获取文档详情错误:', error);
    res.status(500).json({ message: '获取文档详情失败' });
  }
});

// 更新文档块
router.put('/chunks/:chunkId', async (req, res) => {
  try {
    const { chunkId } = req.params;
    const { content } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ message: '内容不能为空' });
    }
    
    // 获取系统配置
    const config = await getSystemConfig();
    const useEmbeddingAPI = config.apiKey && config.knowledgeBase.embeddingModel;
    
    // 重新向量化
    let embedding: number[];
    if (useEmbeddingAPI) {
      console.log(`🔄 重新向量化文档块: ${chunkId}`);
      embedding = await vectorizeWithFireworks(
        content,
        config.apiKey!,
        config.knowledgeBase.embeddingModel
      );
    } else {
      embedding = simpleVectorize(content);
    }
    
    // 更新文档块
    await prisma.documentChunk.update({
      where: { id: chunkId },
      data: {
        content,
        embedding: JSON.stringify(embedding),
      },
    });
    
    console.log(`✅ 文档块更新成功: ${chunkId}`);
    res.json({ message: '文档块更新成功' });
  } catch (error: any) {
    console.error('更新文档块错误:', error);
    res.status(500).json({ message: '更新文档块失败' });
  }
});

export default router;
