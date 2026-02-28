import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();
const CONFIG_PATH = path.join(process.cwd(), 'data', 'system-config.json');

// 使用认证中间件
router.use(authenticate);

// 获取系统配置
async function getSystemConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取配置失败:', error);
    return null;
  }
}

// 文档生成路由（基于代码文件 - 流式输出）
router.post('/generate-from-code-stream', async (req: AuthRequest, res) => {
  try {
    const { title, fileName, fileContent, requirements, model, language } = req.body;
    
    const config = await getSystemConfig();
    if (!config) {
      return res.status(500).json({ message: '无法读取系统配置' });
    }
    
    const provider = config.providers[config.selectedProvider];
    const apiKey = provider?.apiKeys?.find((k: any) => k.id === config.selectedApiKey);
    
    if (!apiKey) {
      return res.status(400).json({ message: '请先配置 API Key' });
    }

    // 根据语言选择构建提示
    let languageInstruction = '';
    let systemPrompt = '';
    
    if (language === 'chinese') {
      languageInstruction = '请使用中文生成完整的技术文档。';
      systemPrompt = `你是专业的技术文档分析助手，将原始代码文档重构为规范的中文Markdown格式。

## 文档结构（按顺序）

1. **封面** → 分页符
2. **版本更新记录**（表格） → 分页符
3. **目录** → 分页符
4. **概述**（编写目的、适用范围、读者对象、文档约定）
5. **数据类型定义**（宏定义、结构体、枚举、类型定义）→ 分页符
6. **函数章节**（按原文档章节划分）→ 每章前分页符
7. **错误码**（单独章节）→ 分页符

## 关键要求

### 数据类型定义
- **宏定义**：表格（宏名称|值|含义|用途），不包括错误码
- **结构体**：每个单独说明（名称、代码块、成员表格、用途）
- **完整性**：不得遗漏任何定义

### 函数章节
- **目录结构**：一级标题=章节名，二级标题=函数名
- **函数格式**：包含函数原型、功能简介（首行缩进2个全角空格）、输入/输出参数表格、返回值、调用示例
- **空行规则**：函数间2个空行，函数内部不要空行

### 错误码
- 表格：错误码|错误名称|十六进制值|错误描述|可能原因

## 格式规范
- 分页符：\`<div style="page-break-after: always;"></div>\`
- 代码块：指定语言（cpp/java）
- 表格：Markdown标准语法
- 专业术语，避免口语化

## 输出要求
- 直接输出Markdown，无需额外说明
- 确保完整性，不得遗漏
- 内容精简（函数说明150-200字）
- 功能简介首行必须缩进2个全角空格（　　）`;
    } else if (language === 'english') {
      languageInstruction = 'Please generate a complete technical documentation in English.';
      systemPrompt = `You are a professional technical documentation assistant, reconstructing raw code documentation into standardized English Markdown format.

## Document Structure (in order)

1. **Cover Page** → Page Break
2. **Version History** (table) → Page Break
3. **Table of Contents** → Page Break
4. **Overview** (Purpose, Scope, Audience, Conventions)
5. **Data Type Definitions** (Macros, Structs, Enums, Typedefs) → Page Break
6. **Function Chapters** (organized by original document chapters) → Page Break before each chapter
7. **Error Codes** (separate chapter) → Page Break

## Key Requirements

### Data Type Definitions
- **Macros**: Table (Macro Name | Value | Meaning | Usage), excluding error codes
- **Structures**: Individual description for each (Name, Code Block, Member Table, Usage)
- **Completeness**: No definitions should be omitted

### Function Chapters
- **Structure**: Level-1 heading = chapter name, Level-2 heading = function name
- **Function Format**: Include function prototype, description, input/output parameter tables, return value, usage example
- **Spacing Rules**: 2 blank lines between functions, no blank lines within function sections

### Error Codes
- Table: Error Code | Error Name | Hex Value | Description | Possible Causes

## Format Specifications
- Page Break: \`<div style="page-break-after: always;"></div>\`
- Code Blocks: Specify language (cpp/java)
- Tables: Standard Markdown syntax
- Professional terminology

## Output Requirements
- Output Markdown directly, no additional explanations
- Ensure completeness, no omissions
- Concise content (function descriptions 100-150 words)
- Professional and technical tone`;
    }

    // 构建生成文档的 prompt
    const prompt = `请为以下代码文件生成技术文档。

文件名：${fileName}
文件内容：
\`\`\`
${fileContent}
\`\`\`

生成要求：
${requirements}

${languageInstruction}

请生成详细的 Markdown 格式技术文档，包括：
1. 文件概述
2. 主要功能和类/函数说明
3. 参数和返回值说明
4. 使用示例
5. 注意事项

使用标准的 Markdown 语法，包括代码块、列表等。`;
    
    const fetch = (await import('node-fetch')).default;
    
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    const response = await fetch(provider.apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.key}`,
      },
      body: JSON.stringify({
        model: model || config.selectedModel,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: true,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData: any = await response.json();
      res.write(`data: ${JSON.stringify({ error: errorData.error?.message || 'AI调用失败' })}\n\n`);
      res.end();
      return;
    }

    let totalTokens = 0;
    let lastDataTime = Date.now();
    const TIMEOUT = 30000; // 30秒无数据超时

    // 设置超时检测
    const timeoutChecker = setInterval(() => {
      const now = Date.now();
      if (now - lastDataTime > TIMEOUT) {
        clearInterval(timeoutChecker);
        res.write(`data: ${JSON.stringify({ error: 'API 超过 30 秒无响应' })}\n\n`);
        res.end();
      }
    }, 1000);

    // 读取流式响应
    const reader = response.body;
    if (reader) {
      reader.on('data', (chunk: Buffer) => {
        // 收到数据，更新时间
        lastDataTime = Date.now();
        
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              clearInterval(timeoutChecker);
              res.write(`data: ${JSON.stringify({ tokens: totalTokens })}\n\n`);
              res.write('data: [DONE]\n\n');
              res.end();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
              // 累计 tokens
              if (parsed.usage?.total_tokens) {
                totalTokens = parsed.usage.total_tokens;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });

      reader.on('end', () => {
        clearInterval(timeoutChecker);
        res.write(`data: ${JSON.stringify({ tokens: totalTokens })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      });

      reader.on('error', (error: any) => {
        clearInterval(timeoutChecker);
        console.error('Stream error:', error);
        res.write(`data: ${JSON.stringify({ error: '流式传输错误' })}\n\n`);
        res.end();
      });
    }
  } catch (error: any) {
    console.error('Document Generation Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || '文档生成失败' })}\n\n`);
    res.end();
  }
});

// PDF 转换路由
router.post('/convert-pdf', async (req: AuthRequest, res) => {
  try {
    const { content, title } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: '缺少文档内容' });
    }

    // 使用 markdown-pdf 或其他库转换
    // 这里使用简单的 HTML 转换方案
    const marked = (await import('marked')).marked;
    const htmlContent = await marked.parse(content);
    
    // 构建完整的 HTML 文档
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title || '文档'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      color: #333;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }
    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    code {
      background-color: #f6f8fa;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 0.9em;
    }
    pre {
      background-color: #f6f8fa;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
    }
    pre code {
      background-color: transparent;
      padding: 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }
    table th, table td {
      border: 1px solid #dfe2e5;
      padding: 8px 13px;
    }
    table th {
      background-color: #f6f8fa;
      font-weight: 600;
    }
    blockquote {
      border-left: 4px solid #dfe2e5;
      padding-left: 16px;
      color: #6a737d;
      margin: 16px 0;
    }
    img {
      max-width: 100%;
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    ul, ol {
      padding-left: 2em;
    }
    li {
      margin: 4px 0;
    }
    div[style*="page-break-after"] {
      page-break-after: always;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
    `;

    // 使用 puppeteer 或 html-pdf-node 生成 PDF
    // 这里使用 html-pdf-node
    const htmlPdf = (await import('html-pdf-node')).default;
    
    const options = {
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
      printBackground: true,
    };

    const file = { content: fullHtml };
    const pdfBuffer = await htmlPdf.generatePdf(file, options);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title || '文档')}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('PDF 转换失败:', error);
    res.status(500).json({ message: 'PDF 转换失败', error: error.message });
  }
});

export default router;
