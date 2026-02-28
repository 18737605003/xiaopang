import { Router } from 'express';
import OpenAI from 'openai';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { logAIUsage } from '../utils/logger.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// 动态获取系统配置
function getSystemConfig() {
  try {
    const configPath = path.join(process.cwd(), 'data', 'system-config.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      const provider = config.providers?.[config.selectedProvider];
      const selectedApiKey = provider?.apiKeys?.find((k: any) => k.id === config.selectedApiKey);
      
      // Fireworks AI 使用 /inference/v1 作为 base URL
      // OpenAI SDK 会自动添加 /chat/completions
      let baseURL = 'https://api.openai.com/v1';
      if (config.selectedProvider === 'fireworks') {
        baseURL = 'https://api.fireworks.ai/inference/v1';
      } else if (provider?.apiUrl) {
        // 从完整 URL 中提取 base URL（移除 /chat/completions）
        baseURL = provider.apiUrl.replace(/\/chat\/completions.*$/, '');
      }
      
      return {
        apiKey: selectedApiKey?.key || null,
        baseURL,
        model: config.selectedModel || 'gpt-3.5-turbo',
      };
    }
  } catch (error) {
    console.error('读取系统配置失败:', error);
  }
  
  return {
    apiKey: process.env.OPENAI_API_KEY || null,
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
  };
}

const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
  'gpt-4-turbo': { input: 0.01 / 1000, output: 0.03 / 1000 },
  'gpt-3.5-turbo': { input: 0.0015 / 1000, output: 0.002 / 1000 },
  'dall-e-3': { input: 0.04, output: 0 },
};

function calculateCost(model: string, inputTokens?: number, outputTokens?: number): number | undefined {
  const pricing = MODEL_PRICES[model];
  if (!pricing) return undefined;
  return (inputTokens || 0) * pricing.input + (outputTokens || 0) * pricing.output;
}

router.use(authenticate);

router.post('/chat-stream', async (req: AuthRequest, res) => {
  const startTime = Date.now();
  const { messages, model: requestModel, temperature = 0.7 } = req.body;

  try {
    // 获取系统配置
    const config = getSystemConfig();
    const model = requestModel || config.model;
    
    if (!config.apiKey) {
      throw new Error('未配置 API Key，请在系统设置中配置');
    }
    
    // 创建 OpenAI 客户端（支持 Fireworks AI）
    const openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      stream: true,
    });

    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        outputTokens++;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

    const duration = Date.now() - startTime;
    const cost = calculateCost(model, inputTokens, outputTokens);

    await logAIUsage({
      userId: req.user!.id,
      username: req.user!.username,
      model,
      action: 'chat',
      inputTokens,
      outputTokens,
      cost,
      duration,
      status: 'SUCCESS',
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    await logAIUsage({
      userId: req.user!.id,
      username: req.user!.username,
      model,
      action: 'chat',
      duration,
      status: 'FAILURE',
      errorMessage: error.message,
    });

    await logger.error('ai', 'AI流式对话失败', error.stack, { userId: req.user!.id, model });
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

router.post('/chat', async (req: AuthRequest, res) => {
  const startTime = Date.now();
  const { messages, model: requestModel, temperature = 0.7 } = req.body;

  try {
    // 获取系统配置
    const config = getSystemConfig();
    const model = requestModel || config.model;
    
    if (!config.apiKey) {
      throw new Error('未配置 API Key，请在系统设置中配置');
    }
    
    // 创建 OpenAI 客户端
    const openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
    });

    const duration = Date.now() - startTime;
    const inputTokens = completion.usage?.prompt_tokens;
    const outputTokens = completion.usage?.completion_tokens;
    const cost = calculateCost(model, inputTokens, outputTokens);

    await logAIUsage({
      userId: req.user!.id,
      username: req.user!.username,
      model,
      action: 'chat',
      inputTokens,
      outputTokens,
      cost,
      duration,
      status: 'SUCCESS',
    });

    res.json({
      content: completion.choices[0].message.content,
      usage: completion.usage,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    await logAIUsage({
      userId: req.user!.id,
      username: req.user!.username,
      model,
      action: 'chat',
      duration,
      status: 'FAILURE',
      errorMessage: error.message,
    });

    await logger.error('ai', 'AI对话失败', error.stack, { userId: req.user!.id, model });
    res.status(500).json({ message: error.message || 'AI对话失败' });
  }
});

router.post('/analyze-document', async (req: AuthRequest, res) => {
  const startTime = Date.now();
  const { content, model: requestModel } = req.body;

  try {
    // 获取系统配置
    const config = getSystemConfig();
    const model = requestModel || config.model;
    
    if (!config.apiKey) {
      throw new Error('未配置 API Key，请在系统设置中配置');
    }
    
    // 创建 OpenAI 客户端
    const openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: '你是一个文档分析专家，请分析以下文档内容并提供结构化的分析报告。' },
        { role: 'user', content: `请分析以下文档：\n\n${content}` },
      ],
    });

    const duration = Date.now() - startTime;
    const inputTokens = completion.usage?.prompt_tokens;
    const outputTokens = completion.usage?.completion_tokens;
    const cost = calculateCost(model, inputTokens, outputTokens);

    await logAIUsage({
      userId: req.user!.id,
      username: req.user!.username,
      model,
      action: 'analysis',
      inputTokens,
      outputTokens,
      cost,
      duration,
      status: 'SUCCESS',
    });

    res.json({
      analysis: completion.choices[0].message.content,
      usage: completion.usage,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    await logAIUsage({
      userId: req.user!.id,
      username: req.user!.username,
      model,
      action: 'analysis',
      duration,
      status: 'FAILURE',
      errorMessage: error.message,
    });

    await logger.error('ai', '文档分析失败', error.stack, { userId: req.user!.id });
    res.status(500).json({ message: error.message || '文档分析失败' });
  }
});

router.post('/generate-image', async (req: AuthRequest, res) => {
  const startTime = Date.now();
  const { prompt } = req.body;
  const model = 'dall-e-3';

  try {
    // 获取系统配置
    const config = getSystemConfig();
    
    if (!config.apiKey) {
      throw new Error('未配置 API Key，请在系统设置中配置');
    }
    
    // 创建 OpenAI 客户端
    const openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    const response = await openai.images.generate({
      model,
      prompt,
      n: 1,
      size: '1024x1024',
    });

    const duration = Date.now() - startTime;
    const cost = MODEL_PRICES[model]?.input;

    await logAIUsage({
      userId: req.user!.id,
      username: req.user!.username,
      model,
      action: 'generation',
      cost,
      duration,
      status: 'SUCCESS',
    });

    res.json({ url: response.data[0].url });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    await logAIUsage({
      userId: req.user!.id,
      username: req.user!.username,
      model,
      action: 'generation',
      duration,
      status: 'FAILURE',
      errorMessage: error.message,
    });

    await logger.error('ai', '图像生成失败', error.stack, { userId: req.user!.id, prompt });
    res.status(500).json({ message: error.message || '图像生成失败' });
  }
});

export default router;