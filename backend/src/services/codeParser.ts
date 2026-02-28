/**
 * 代码解析服务 - 使用 AST 提取函数和构建调用图
 */
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as fs from 'fs';
import * as path from 'path';

// 修复 TypeScript 导入问题
const traverseDefault = (traverse as any).default || traverse;

export interface FunctionInfo {
  name: string;
  code: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  params: string[];
  isAsync: boolean;
  complexity: number;
}

export interface CallGraphEdge {
  caller: string;
  callee: string;
  file: string;
  line: number;
}

export class CodeParser {
  private functions: Map<string, FunctionInfo> = new Map();
  private callGraph: CallGraphEdge[] = [];
  
  /**
   * 解析单个文件，提取所有函数
   */
  parseFile(filePath: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    
    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath);
      
      // 跳过非代码文件
      if (!ext.match(/\.(js|ts|jsx|tsx)$/)) {
        return functions;
      }
      
      // 根据文件类型选择解析器配置
      const parserOptions: any = {
        sourceType: 'module',
        plugins: ['decorators-legacy'],
        errorRecovery: true, // 启用错误恢复
      };
      
      if (ext === '.ts' || ext === '.tsx') {
        parserOptions.plugins.push('typescript');
      }
      if (ext === '.jsx' || ext === '.tsx') {
        parserOptions.plugins.push('jsx');
      }
      
      let ast;
      try {
        ast = parser.parse(code, parserOptions);
      } catch (parseError: any) {
        // 如果解析失败，尝试作为脚本模式解析
        try {
          parserOptions.sourceType = 'script';
          ast = parser.parse(code, parserOptions);
        } catch (scriptError) {
          // 静默跳过，不输出错误（避免日志噪音）
          return functions;
        }
      }
      
      // 遍历 AST 提取函数
      traverseDefault(ast, {
        FunctionDeclaration: (nodePath) => {
          const node = nodePath.node;
          if (node.id) {
            functions.push(this.extractFunctionInfo(node, code, filePath));
          }
        },
        FunctionExpression: (nodePath) => {
          const node = nodePath.node;
          const parent = nodePath.parent;
          
          // 处理 const foo = function() {} 形式
          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            functions.push(this.extractFunctionInfo(node, code, filePath, parent.id.name));
          }
        },
        ArrowFunctionExpression: (nodePath) => {
          const node = nodePath.node;
          const parent = nodePath.parent;
          
          // 处理 const foo = () => {} 形式
          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            functions.push(this.extractFunctionInfo(node, code, filePath, parent.id.name));
          }
        },
        ClassMethod: (nodePath) => {
          const node = nodePath.node;
          if (node.key.type === 'Identifier') {
            const className = this.getClassName(nodePath);
            const methodName = `${className}.${node.key.name}`;
            functions.push(this.extractFunctionInfo(node, code, filePath, methodName));
          }
        },
      });
      
    } catch (error) {
      // 静默跳过文件访问错误
    }
    
    return functions;
  }
  
  /**
   * 提取函数信息
   */
  private extractFunctionInfo(node: any, code: string, filePath: string, name?: string): FunctionInfo {
    const functionName = name || node.id?.name || 'anonymous';
    const start = node.loc.start.line;
    const end = node.loc.end.line;
    
    // 提取函数代码
    const lines = code.split('\n');
    const functionCode = lines.slice(start - 1, end).join('\n');
    
    // 提取参数
    const params = node.params.map((param: any) => {
      if (param.type === 'Identifier') {
        return param.name;
      } else if (param.type === 'RestElement') {
        return `...${param.argument.name}`;
      }
      return 'unknown';
    });
    
    // 计算圈复杂度（简化版）
    const complexity = this.calculateComplexity(functionCode);
    
    return {
      name: functionName,
      code: functionCode,
      file: filePath,
      lineStart: start,
      lineEnd: end,
      params,
      isAsync: node.async || false,
      complexity,
    };
  }
  
  /**
   * 获取类名
   */
  private getClassName(nodePath: any): string {
    let current = nodePath.parentPath;
    while (current) {
      if (current.node.type === 'ClassDeclaration' && current.node.id) {
        return current.node.id.name;
      }
      current = current.parentPath;
    }
    return 'UnknownClass';
  }
  
  /**
   * 计算圈复杂度
   */
  private calculateComplexity(code: string): number {
    let complexity = 1; // 基础复杂度
    
    // 统计控制流语句
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
   * 构建调用图
   */
  buildCallGraph(filePath: string): CallGraphEdge[] {
    const edges: CallGraphEdge[] = [];
    
    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath);
      
      // 跳过非代码文件
      if (!ext.match(/\.(js|ts|jsx|tsx)$/)) {
        return edges;
      }
      
      const parserOptions: any = {
        sourceType: 'module',
        plugins: ['decorators-legacy'],
        errorRecovery: true,
      };
      
      if (ext === '.ts' || ext === '.tsx') {
        parserOptions.plugins.push('typescript');
      }
      if (ext === '.jsx' || ext === '.tsx') {
        parserOptions.plugins.push('jsx');
      }
      
      let ast;
      try {
        ast = parser.parse(code, parserOptions);
      } catch (parseError) {
        try {
          parserOptions.sourceType = 'script';
          ast = parser.parse(code, parserOptions);
        } catch (scriptError) {
          return edges;
        }
      }
      
      let currentFunction: string | null = null;
      
      traverseDefault(ast, {
        FunctionDeclaration: (nodePath) => {
          if (nodePath.node.id) {
            currentFunction = nodePath.node.id.name;
          }
        },
        FunctionExpression: (nodePath) => {
          const parent = nodePath.parent;
          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            currentFunction = parent.id.name;
          }
        },
        ArrowFunctionExpression: (nodePath) => {
          const parent = nodePath.parent;
          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            currentFunction = parent.id.name;
          }
        },
        CallExpression: (nodePath) => {
          if (!currentFunction) return;
          
          const node = nodePath.node;
          let calleeName: string | null = null;
          
          if (node.callee.type === 'Identifier') {
            calleeName = node.callee.name;
          } else if (node.callee.type === 'MemberExpression') {
            if (node.callee.property.type === 'Identifier') {
              calleeName = node.callee.property.name;
            }
          }
          
          if (calleeName) {
            edges.push({
              caller: currentFunction,
              callee: calleeName,
              file: filePath,
              line: node.loc?.start.line || 0,
            });
          }
        },
      });
      
    } catch (error) {
      // 静默跳过
    }
    
    return edges;
  }
  
  /**
   * 扫描整个仓库
   */
  scanRepository(repoPath: string): {
    functions: Map<string, FunctionInfo>;
    callGraph: CallGraphEdge[];
    stats: {
      totalFiles: number;
      parsedFiles: number;
      skippedFiles: number;
    };
  } {
    this.functions.clear();
    this.callGraph = [];
    
    const stats = {
      totalFiles: 0,
      parsedFiles: 0,
      skippedFiles: 0,
    };
    
    console.log(`🔍 开始扫描仓库: ${repoPath}`);
    
    // 检查目录是否存在
    if (!fs.existsSync(repoPath)) {
      console.error(`❌ 目录不存在: ${repoPath}`);
      return { functions: this.functions, callGraph: this.callGraph, stats };
    }
    
    // 列出根目录内容
    try {
      const rootFiles = fs.readdirSync(repoPath);
      console.log(`📁 根目录文件数: ${rootFiles.length}`);
      console.log(`   前10个文件/目录: ${rootFiles.slice(0, 10).join(', ')}`);
    } catch (error) {
      console.error(`❌ 无法读取目录: ${error}`);
    }
    
    this.walkDirectory(repoPath, stats);
    
    console.log(`📊 代码解析统计: 总文件 ${stats.totalFiles}, 成功解析 ${stats.parsedFiles}, 跳过 ${stats.skippedFiles}`);
    
    return {
      functions: this.functions,
      callGraph: this.callGraph,
      stats,
    };
  }
  
  /**
   * 递归遍历目录
   */
  private walkDirectory(dir: string, stats?: any, depth: number = 0) {
    if (depth === 0) {
      console.log(`🚶 开始遍历目录: ${dir}`);
    }
    
    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch (error) {
      console.error(`❌ 无法读取目录 ${dir}:`, error);
      return;
    }
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      
      // 跳过特殊目录
      if (file === 'node_modules' || file === '.git' || file === 'dist' || 
          file === 'build' || file === 'vendor' || file === 'coverage') {
        continue;
      }
      
      try {
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          this.walkDirectory(filePath, stats, depth + 1);
        } else if (file.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|h|hpp|go|rs)$/)) {
          if (stats) stats.totalFiles++;
          
          if (depth === 0 || stats.totalFiles <= 5) {
            console.log(`   发现代码文件: ${file}`);
          }
          
          // 只解析 JS/TS 文件
          if (file.match(/\.(js|ts|jsx|tsx)$/)) {
            // 解析函数
            const functions = this.parseFile(filePath);
            if (functions.length > 0) {
              if (stats) stats.parsedFiles++;
              functions.forEach(func => {
                this.functions.set(`${func.file}:${func.name}`, func);
              });
              
              // 构建调用图
              const edges = this.buildCallGraph(filePath);
              this.callGraph.push(...edges);
            } else {
              if (stats) stats.skippedFiles++;
            }
          } else {
            // 其他语言暂时跳过 AST 解析
            if (stats) stats.skippedFiles++;
          }
        }
      } catch (error) {
        // 忽略文件访问错误
      }
    }
  }
  
  /**
   * 获取函数的调用上下文
   */
  getCallContext(functionName: string): {
    callers: string[];
    callees: string[];
  } {
    const callers = this.callGraph
      .filter(edge => edge.callee === functionName)
      .map(edge => edge.caller);
    
    const callees = this.callGraph
      .filter(edge => edge.caller === functionName)
      .map(edge => edge.callee);
    
    return {
      callers: Array.from(new Set(callers)),
      callees: Array.from(new Set(callees)),
    };
  }
}
