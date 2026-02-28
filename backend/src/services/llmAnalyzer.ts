/**
 * LLM 代码分析服务 - 使用 Claude 进行深度分析
 */
import { FunctionInfo } from './codeParser.js';

export interface Bug {
  type: 'memory_leak' | 'logic_error' | 'race_condition' | 'security' | 'performance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  line: number;
  description: string;
  suggestion: string;
  confidence: number;
  cwe?: string;
}

export interface AnalysisResult {
  function: string;
  file: string;
  bugs: Bug[];
  summary: string;
}

export class LLMAnalyzer {
  private apiKey: string;
  private apiUrl: string;
  private model: string;
  
  constructor(apiKey: string, apiUrl: string = 'https://api.fireworks.ai/inference/v1/chat/completions', model: string = 'accounts/fireworks/models/glm-5') {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.model = model;
  }
  
  /**
   * 分析单个函数
   */
  async analyzeFunction(
    func: FunctionInfo,
    callContext: { callers: string[]; callees: string[] }
  ): Promise<AnalysisResult> {
    const prompt = this.buildAnalysisPrompt(func, callContext);
    
    try {
      const response = await this.callLLM(prompt);
      const result = this.parseResponse(response, func);
      return result;
    } catch (error) {
      console.error(`分析函数失败 ${func.name}:`, error);
      return {
        function: func.name,
        file: func.file,
        bugs: [],
        summary: '分析失败',
      };
    }
  }
  
  /**
   * 构建分析提示词
   */
  private buildAnalysisPrompt(
    func: FunctionInfo,
    callContext: { callers: string[]; callees: string[] }
  ): string {
    return `你是一个专业的代码安全和质量分析专家。分析以下函数，重点检测：

1. **内存泄漏**：资源（文件句柄、连接、内存）分配后未释放，异常路径是否有泄漏
2. **逻辑错误**：边界条件、空指针/null/undefined检查、整数溢出、错误的控制流
3. **资源竞争**：多线程/异步场景下的共享状态问题
4. **安全漏洞**：SQL注入、XSS、命令注入、硬编码密钥等
5. **性能问题**：不必要的循环、低效算法、重复计算

【调用上下文】
- 被以下函数调用：${callContext.callers.length > 0 ? callContext.callers.join(', ') : '无'}
- 内部调用了：${callContext.callees.length > 0 ? callContext.callees.join(', ') : '无'}
- 圈复杂度：${func.complexity}
- 是否异步：${func.isAsync ? '是' : '否'}

【待分析函数】
文件：${func.file}
函数名：${func.name}
起始行：${func.lineStart}
参数：${func.params.join(', ')}

\`\`\`typescript
${func.code}
\`\`\`

请以JSON格式返回分析结果：
{
  "bugs": [
    {
      "type": "memory_leak|logic_error|race_condition|security|performance",
      "severity": "critical|high|medium|low",
      "line": <相对于函数起始行的行号>,
      "description": "问题的详细描述",
      "suggestion": "具体的修复建议",
      "confidence": 0.0-1.0,
      "cwe": "CWE编号（如果适用）"
    }
  ],
  "summary": "函数整体评价（1-2句话）"
}

注意：
- 只返回JSON，不要其他内容
- confidence 表示你对这个问题的确信程度（0.0-1.0）
- 只报告真正的问题，不要过度报告
- 如果没有发现问题，bugs 数组为空
- line 是相对于函数起始行的行号（从1开始）`;
  }
  
  /**
   * 调用 LLM API
   */
  private async callLLM(prompt: string): Promise<string> {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的代码安全和质量分析专家，擅长发现代码中的漏洞、逻辑错误和性能问题。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.3, // 降低温度以获得更确定的结果
      }),
    });
    
    if (!response.ok) {
      throw new Error(`LLM API 调用失败: ${response.statusText}`);
    }
    
    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
  
  /**
   * 解析 LLM 响应
   */
  private parseResponse(response: string, func: FunctionInfo): AnalysisResult {
    try {
      // 提取 JSON（可能被包裹在 markdown 代码块中）
      let jsonStr = response.trim();
      
      // 移除 markdown 代码块标记
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(jsonStr);
      
      // 转换相对行号为绝对行号
      const bugs: Bug[] = (parsed.bugs || []).map((bug: any) => ({
        ...bug,
        line: func.lineStart + (bug.line || 0) - 1,
      }));
      
      return {
        function: func.name,
        file: func.file,
        bugs,
        summary: parsed.summary || '',
      };
    } catch (error) {
      console.error('解析 LLM 响应失败:', error);
      console.error('原始响应:', response);
      return {
        function: func.name,
        file: func.file,
        bugs: [],
        summary: '解析失败',
      };
    }
  }
  
  /**
   * 二次审查（减少误报）
   */
  async reviewBugs(bugs: Bug[], func: FunctionInfo): Promise<Bug[]> {
    if (bugs.length === 0) return [];
    
    const prompt = `作为代码审查专家，请审查以下检测到的问题，判断是否为误报。

【函数代码】
\`\`\`typescript
${func.code}
\`\`\`

【检测到的问题】
${bugs.map((bug, idx) => `${idx + 1}. [${bug.type}] ${bug.description} (置信度: ${bug.confidence})`).join('\n')}

请对每个问题进行审查，返回JSON格式：
{
  "results": [
    {
      "index": <问题序号，从1开始>,
      "is_false_positive": true|false,
      "reason": "判断理由"
    }
  ]
}

只返回JSON，不要其他内容。`;
    
    try {
      const response = await this.callLLM(prompt);
      const parsed = JSON.parse(response.replace(/^```json\s*/, '').replace(/\s*```$/, ''));
      
      // 过滤误报
      const validBugs = bugs.filter((bug, idx) => {
        const review = parsed.results?.find((r: any) => r.index === idx + 1);
        return !review?.is_false_positive;
      });
      
      return validBugs;
    } catch (error) {
      console.error('二次审查失败:', error);
      // 如果审查失败，返回原始结果
      return bugs;
    }
  }
  
  /**
   * 批量分析函数（带并发控制）
   */
  async analyzeFunctions(
    functions: FunctionInfo[],
    getCallContext: (name: string) => { callers: string[]; callees: string[] },
    options: {
      concurrency?: number;
      confidenceThreshold?: number;
      enableReview?: boolean;
      onProgress?: (current: number, total: number) => void;
    } = {}
  ): Promise<AnalysisResult[]> {
    const {
      concurrency = 3,
      confidenceThreshold = 0.7,
      enableReview = true,
      onProgress,
    } = options;
    
    const results: AnalysisResult[] = [];
    let completed = 0;
    
    // 分批处理
    for (let i = 0; i < functions.length; i += concurrency) {
      const batch = functions.slice(i, Math.min(i + concurrency, functions.length));
      
      const batchResults = await Promise.all(
        batch.map(async (func) => {
          const callContext = getCallContext(func.name);
          let result = await this.analyzeFunction(func, callContext);
          
          // 过滤低置信度问题
          result.bugs = result.bugs.filter(bug => bug.confidence >= confidenceThreshold);
          
          // 二次审查
          if (enableReview && result.bugs.length > 0) {
            result.bugs = await this.reviewBugs(result.bugs, func);
          }
          
          completed++;
          if (onProgress) {
            onProgress(completed, functions.length);
          }
          
          return result;
        })
      );
      
      results.push(...batchResults);
      
      // 批次间延迟，避免 API 限流
      if (i + concurrency < functions.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}
