/**
 * C/C++ 代码 LLM 分析服务
 */
import { CppFunctionInfo } from './cppParser.js';

export interface CppBug {
  type: 'memory_leak' | 'buffer_overflow' | 'null_pointer' | 'use_after_free' | 'double_free' | 'logic_error' | 'security';
  severity: 'critical' | 'high' | 'medium' | 'low';
  line: number;
  description: string;
  suggestion: string;
  confidence: number;
  cwe?: string;
}

export interface CppAnalysisResult {
  function: string;
  file: string;
  bugs: CppBug[];
  summary: string;
}

export class CppAnalyzer {
  private apiKey: string;
  private apiUrl: string;
  private model: string;
  
  constructor(apiKey: string, apiUrl: string = 'https://api.fireworks.ai/inference/v1/chat/completions', model: string = 'accounts/fireworks/models/glm-5') {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.model = model;
  }
  
  /**
   * 分析单个 C/C++ 函数
   */
  async analyzeFunction(func: CppFunctionInfo): Promise<CppAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(func);
    
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
   * 构建 C/C++ 专用分析提示词
   */
  private buildAnalysisPrompt(func: CppFunctionInfo): string {
    return `你是一个专业的 C/C++ 代码安全和质量分析专家。分析以下函数，重点检测：

1. **内存泄漏**：malloc/calloc/realloc/new 分配的内存未释放，异常路径是否有泄漏
2. **缓冲区溢出**：strcpy/strcat/sprintf/gets 等不安全函数，数组越界访问
3. **空指针解引用**：指针使用前未检查 NULL
4. **Use-After-Free**：释放后使用指针
5. **Double-Free**：重复释放同一块内存
6. **整数溢出**：算术运算可能导致溢出
7. **逻辑错误**：边界条件、错误的控制流
8. **安全漏洞**：格式化字符串漏洞、命令注入等

【函数信息】
文件：${func.file}
函数名：${func.name}
返回类型：${func.returnType}
参数：${func.params}
起始行：${func.lineStart}
圈复杂度：${func.complexity}
使用指针：${func.isPointer ? '是' : '否'}
有内存分配：${func.hasMemoryAlloc ? '是' : '否'}

【函数代码】
\`\`\`c
${func.code}
\`\`\`

请以JSON格式返回分析结果：
{
  "bugs": [
    {
      "type": "memory_leak|buffer_overflow|null_pointer|use_after_free|double_free|logic_error|security",
      "severity": "critical|high|medium|low",
      "line": <相对于函数起始行的行号>,
      "description": "问题的详细描述",
      "suggestion": "具体的修复建议（包括代码示例）",
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
- line 是相对于函数起始行的行号（从1开始）
- 特别关注 C/C++ 特有的内存管理问题`;
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
            content: '你是一个专业的 C/C++ 代码安全和质量分析专家，擅长发现内存泄漏、缓冲区溢出、空指针等问题。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
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
  private parseResponse(response: string, func: CppFunctionInfo): CppAnalysisResult {
    try {
      let jsonStr = response.trim();
      
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(jsonStr);
      
      const bugs: CppBug[] = (parsed.bugs || []).map((bug: any) => ({
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
      return {
        function: func.name,
        file: func.file,
        bugs: [],
        summary: '解析失败',
      };
    }
  }
  
  /**
   * 批量分析函数
   */
  async analyzeFunctions(
    functions: CppFunctionInfo[],
    options: {
      concurrency?: number;
      confidenceThreshold?: number;
      onProgress?: (current: number, total: number) => void;
    } = {}
  ): Promise<CppAnalysisResult[]> {
    const {
      concurrency = 2,
      confidenceThreshold = 0.7,
      onProgress,
    } = options;
    
    const results: CppAnalysisResult[] = [];
    let completed = 0;
    
    for (let i = 0; i < functions.length; i += concurrency) {
      const batch = functions.slice(i, Math.min(i + concurrency, functions.length));
      
      const batchResults = await Promise.all(
        batch.map(async (func) => {
          let result = await this.analyzeFunction(func);
          
          // 过滤低置信度问题
          result.bugs = result.bugs.filter(bug => bug.confidence >= confidenceThreshold);
          
          completed++;
          if (onProgress) {
            onProgress(completed, functions.length);
          }
          
          return result;
        })
      );
      
      results.push(...batchResults);
      
      // 批次间延迟
      if (i + concurrency < functions.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}
