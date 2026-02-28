/**
 * C/C++ 代码解析服务 - 使用正则表达式提取函数
 */
import * as fs from 'fs';
import * as path from 'path';

export interface CppFunctionInfo {
  name: string;
  code: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  returnType: string;
  params: string;
  isPointer: boolean;
  hasMemoryAlloc: boolean;
  complexity: number;
}

export class CppParser {
  private functions: Map<string, CppFunctionInfo> = new Map();
  
  /**
   * 解析单个 C/C++ 文件
   */
  parseFile(filePath: string): CppFunctionInfo[] {
    const functions: CppFunctionInfo[] = [];
    
    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      const lines = code.split('\n');
      
      // 匹配函数定义的正则表达式
      // 匹配: returnType functionName(params) { ... }
      const functionPattern = /^([a-zA-Z_][\w\s\*&:<>,]*?)\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/gm;
      
      let match;
      while ((match = functionPattern.exec(code)) !== null) {
        const returnType = match[1].trim();
        const functionName = match[2];
        const params = match[3];
        const startPos = match.index;
        
        // 找到函数的结束位置（匹配大括号）
        const functionCode = this.extractFunctionBody(code, startPos);
        if (!functionCode) continue;
        
        // 计算行号
        const beforeFunction = code.substring(0, startPos);
        const lineStart = beforeFunction.split('\n').length;
        const lineEnd = lineStart + functionCode.split('\n').length - 1;
        
        // 分析函数特征
        const isPointer = returnType.includes('*') || params.includes('*');
        const hasMemoryAlloc = /\b(malloc|calloc|realloc|new)\b/.test(functionCode);
        const complexity = this.calculateComplexity(functionCode);
        
        functions.push({
          name: functionName,
          code: functionCode,
          file: filePath,
          lineStart,
          lineEnd,
          returnType,
          params,
          isPointer,
          hasMemoryAlloc,
          complexity,
        });
      }
      
    } catch (error) {
      // 静默跳过
    }
    
    return functions;
  }
  
  /**
   * 提取函数体（匹配大括号）
   */
  private extractFunctionBody(code: string, startPos: number): string | null {
    let braceCount = 0;
    let inFunction = false;
    let functionStart = -1;
    let functionEnd = -1;
    
    for (let i = startPos; i < code.length; i++) {
      const char = code[i];
      
      if (char === '{') {
        if (!inFunction) {
          inFunction = true;
          functionStart = i;
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && inFunction) {
          functionEnd = i + 1;
          break;
        }
      }
    }
    
    if (functionStart !== -1 && functionEnd !== -1) {
      return code.substring(functionStart, functionEnd);
    }
    
    return null;
  }
  
  /**
   * 计算圈复杂度
   */
  private calculateComplexity(code: string): number {
    let complexity = 1;
    
    const patterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /\&\&/g,
      /\|\|/g,
      /\?/g,
    ];
    
    patterns.forEach(pattern => {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }
  
  /**
   * 扫描整个仓库
   */
  scanRepository(repoPath: string): {
    functions: Map<string, CppFunctionInfo>;
    stats: {
      totalFiles: number;
      parsedFiles: number;
      totalFunctions: number;
    };
  } {
    this.functions.clear();
    
    const stats = {
      totalFiles: 0,
      parsedFiles: 0,
      totalFunctions: 0,
    };
    
    console.log(`🔍 开始扫描 C/C++ 代码: ${repoPath}`);
    
    this.walkDirectory(repoPath, stats);
    
    console.log(`📊 C/C++ 解析统计: 总文件 ${stats.totalFiles}, 成功解析 ${stats.parsedFiles}, 函数 ${stats.totalFunctions}`);
    
    return {
      functions: this.functions,
      stats,
    };
  }
  
  /**
   * 递归遍历目录
   */
  private walkDirectory(dir: string, stats: any, depth: number = 0) {
    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch (error) {
      return;
    }
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      
      // 跳过特殊目录
      if (file === 'node_modules' || file === '.git' || file === 'dist' || 
          file === 'build' || file === 'vendor' || file === 'coverage' ||
          file === 'CMakeFiles' || file === 'Debug' || file === 'Release') {
        continue;
      }
      
      try {
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          this.walkDirectory(filePath, stats, depth + 1);
        } else if (file.match(/\.(c|cpp|cc|cxx|h|hpp)$/)) {
          stats.totalFiles++;
          
          if (stats.totalFiles <= 5) {
            console.log(`   发现 C/C++ 文件: ${file}`);
          }
          
          const functions = this.parseFile(filePath);
          if (functions.length > 0) {
            stats.parsedFiles++;
            stats.totalFunctions += functions.length;
            
            functions.forEach(func => {
              this.functions.set(`${func.file}:${func.name}`, func);
            });
          }
        }
      } catch (error) {
        // 忽略错误
      }
    }
  }
}
