import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Bug 类型定义
interface Bug {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  line: number;
  description: string;
  suggestion: string;
  confidence: number;
  file?: string;
  function?: string;
  cwe?: string;
}

// 进度跟踪
const auditProgress = new Map<string, {
  progress: number;
  status: string;
  message: string;
  issues?: Array<{
    severity: string;
    type: string;
    file: string;
    line: number;
    description: string;
  }>;
  liveOutput?: string; // 实时输出文本
}>();

// 更新进度
export function updateAuditProgress(
  taskId: string, 
  progress: number, 
  status: string, 
  message: string,
  issues?: Array<any>,
  liveOutput?: string
) {
  const data: any = { progress, status, message };
  if (issues) {
    data.issues = issues;
  }
  if (liveOutput !== undefined) {
    data.liveOutput = liveOutput;
  }
  auditProgress.set(taskId, data);
  
  // 同时更新数据库
  prisma.auditTask.update({
    where: { id: taskId },
    data: { progress, status, message },
  }).catch(console.error);
}

// 获取进度
export function getAuditProgress(taskId: string) {
  return auditProgress.get(taskId) || { progress: 0, status: 'pending', message: '等待开始...' };
}

// 验证 Git URL（支持多种 Git 服务）
export function isValidGitUrl(url: string): boolean {
  // 支持 GitHub, GitLab, Gitea, Bitbucket, 以及自建 Git 服务
  // 支持 HTTPS 和 SSH 格式
  const patterns = [
    /^https?:\/\/.+\/.+\/.+$/,  // HTTPS: https://domain.com/user/repo
    /^git@.+:.+\/.+\.git$/,     // SSH: git@domain.com:user/repo.git
    /^ssh:\/\/.+\/.+\/.+$/,     // SSH: ssh://git@domain.com/user/repo
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

// 提取仓库名称（支持多种格式）
export function extractRepoName(url: string): string {
  // 移除 .git 后缀
  let cleanUrl = url.replace(/\.git$/, '');
  
  // 处理 SSH 格式: git@domain.com:user/repo
  if (cleanUrl.includes('@') && cleanUrl.includes(':')) {
    const match = cleanUrl.match(/:(.+)/);
    return match ? match[1] : 'unknown';
  }
  
  // 处理 HTTPS 格式: https://domain.com/user/repo
  const match = cleanUrl.match(/\/([^\/]+\/[^\/]+)$/);
  return match ? match[1] : 'unknown';
}

// 获取远程仓库分支列表
export async function getBranches(repoUrl: string, token?: string): Promise<string[]> {
  console.log(`🌿 获取仓库分支: ${repoUrl}`);
  
  try {
    // 如果提供了 token，将其添加到 URL 中（仅用于 HTTPS）
    let authUrl = repoUrl;
    if (token && repoUrl.startsWith('https://')) {
      authUrl = repoUrl.replace('https://', `https://${token}@`);
    }
    
    const git = simpleGit();
    
    // 使用 ls-remote 获取远程分支（不需要克隆）
    const result = await git.listRemote(['--heads', authUrl]);
    
    // 解析分支名称
    const branches = result
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        // 格式: <hash>\trefs/heads/<branch-name>
        const match = line.match(/refs\/heads\/(.+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];
    
    console.log(`✅ 找到 ${branches.length} 个分支:`, branches);
    return branches;
  } catch (error: any) {
    console.error('❌ 获取分支失败:', error.message);
    throw new Error(`无法获取分支列表: ${error.message}`);
  }
}

// 克隆仓库（支持私有仓库）
async function cloneRepository(repoUrl: string, branch: string, token?: string): Promise<string> {
  const tempDir = path.join(process.cwd(), 'temp', `audit-${Date.now()}`);
  
  // 创建临时目录
  fs.mkdirSync(tempDir, { recursive: true });
  
  console.log(`📥 克隆仓库: ${repoUrl} (分支: ${branch})`);
  
  // 如果提供了 token，将其添加到 URL 中（仅用于 HTTPS）
  let authUrl = repoUrl;
  if (token && repoUrl.startsWith('https://')) {
    // 格式: https://token@github.com/user/repo
    authUrl = repoUrl.replace('https://', `https://${token}@`);
  }
  
  try {
    // 克隆仓库（浅克隆，只克隆最新提交）
    const git = simpleGit();
    await git.clone(authUrl, tempDir, ['--depth', '1', '--branch', branch, '--single-branch']);
    
    console.log(`✅ 克隆完成: ${tempDir}`);
    return tempDir;
  } catch (error: any) {
    // 如果克隆失败，尝试不指定分支（使用默认分支）
    if (error.message.includes('Remote branch')) {
      console.log(`⚠️  分支 ${branch} 不存在，尝试使用默认分支...`);
      const git = simpleGit();
      await git.clone(authUrl, tempDir, ['--depth', '1']);
      console.log(`✅ 克隆完成（默认分支）: ${tempDir}`);
      return tempDir;
    }
    throw error;
  }
}

// 分析代码结构
async function analyzeCodeStructure(repoPath: string) {
  console.log(`📊 分析代码结构...`);
  
  const stats = {
    totalFiles: 0,
    totalLines: 0,
    filesByType: {} as Record<string, number>,
    filesByLanguage: {} as Record<string, number>,
  };
  
  const languageMap: Record<string, string> = {
    '.js': 'JavaScript',
    '.ts': 'TypeScript',
    '.jsx': 'React',
    '.tsx': 'React',
    '.py': 'Python',
    '.java': 'Java',
    '.go': 'Go',
    '.rs': 'Rust',
    '.cpp': 'C++',
    '.c': 'C',
    '.php': 'PHP',
    '.rb': 'Ruby',
  };
  
  function walkDir(dir: string) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      
      // 跳过特殊目录
      if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build' || file === 'vendor') {
        continue;
      }
      
      try {
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          walkDir(filePath);
        } else {
          stats.totalFiles++;
          
          // 统计文件类型
          const ext = path.extname(file);
          stats.filesByType[ext] = (stats.filesByType[ext] || 0) + 1;
          
          // 统计语言
          const language = languageMap[ext] || 'Other';
          stats.filesByLanguage[language] = (stats.filesByLanguage[language] || 0) + 1;
          
          // 统计代码行数（只统计代码文件）
          if (languageMap[ext]) {
            try {
              const content = fs.readFileSync(filePath, 'utf-8');
              stats.totalLines += content.split('\n').length;
            } catch (e) {
              // 忽略读取错误
            }
          }
        }
      } catch (e) {
        // 忽略文件访问错误
      }
    }
  }
  
  walkDir(repoPath);
  
  console.log(`✅ 代码结构分析完成: ${stats.totalFiles} 文件, ${stats.totalLines} 行代码`);
  return stats;
}

// 安全扫描
interface Issue {
  type: 'security' | 'quality' | 'best-practice';
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  file: string;
  line: number;
  code: string;
  suggestion: string;
  cwe?: string;
}

async function scanSecurity(repoPath: string): Promise<Issue[]> {
  console.log(`🔍 开始安全扫描...`);
  
  const issues: Issue[] = [];
  
  // 安全规则
  const securityRules = [
    {
      pattern: /SELECT.*FROM.*WHERE.*\$\{.*\}/gi,
      severity: 'critical' as const,
      category: 'SQL Injection',
      title: 'SQL 注入漏洞',
      description: '直接拼接用户输入到 SQL 查询中，可能导致 SQL 注入攻击',
      suggestion: '使用参数化查询或 ORM 框架，例如：db.query("SELECT * FROM users WHERE id = ?", [userId])',
      cwe: 'CWE-89',
    },
    {
      pattern: /(password|secret|api_key|token|private_key)\s*=\s*['"][^'"]{8,}['"]/gi,
      severity: 'critical' as const,
      category: 'Hardcoded Secrets',
      title: '硬编码敏感信息',
      description: '代码中包含硬编码的密钥、密码或令牌',
      suggestion: '使用环境变量或密钥管理服务（如 AWS Secrets Manager、Azure Key Vault）',
      cwe: 'CWE-798',
    },
    {
      pattern: /eval\s*\(/gi,
      severity: 'high' as const,
      category: 'Code Injection',
      title: '不安全的 eval 使用',
      description: 'eval() 可能导致代码注入攻击',
      suggestion: '避免使用 eval()，使用 JSON.parse() 或其他安全的替代方案',
      cwe: 'CWE-95',
    },
    {
      pattern: /innerHTML\s*=.*\$\{/gi,
      severity: 'high' as const,
      category: 'XSS',
      title: 'XSS 跨站脚本漏洞',
      description: '直接将用户输入插入到 innerHTML 中，可能导致 XSS 攻击',
      suggestion: '使用 textContent 或对用户输入进行 HTML 转义',
      cwe: 'CWE-79',
    },
    {
      pattern: /exec\(.*\$\{/gi,
      severity: 'critical' as const,
      category: 'Command Injection',
      title: '命令注入漏洞',
      description: '直接拼接用户输入到系统命令中，可能导致命令注入',
      suggestion: '使用参数化的命令执行方式，或使用白名单验证用户输入',
      cwe: 'CWE-78',
    },
    {
      pattern: /Math\.random\(\)/gi,
      severity: 'medium' as const,
      category: 'Weak Randomness',
      title: '弱随机数生成',
      description: 'Math.random() 不适合用于安全相关的随机数生成',
      suggestion: '使用 crypto.randomBytes() 或 crypto.getRandomValues() 生成安全的随机数',
      cwe: 'CWE-330',
    },
    {
      pattern: /\.md5\(/gi,
      severity: 'medium' as const,
      category: 'Weak Cryptography',
      title: '使用弱加密算法',
      description: 'MD5 已被证明不安全，不应用于密码哈希',
      suggestion: '使用 bcrypt、scrypt 或 Argon2 进行密码哈希',
      cwe: 'CWE-327',
    },
  ];
  
  function scanFile(filePath: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(repoPath, filePath);
      
      lines.forEach((line, index) => {
        securityRules.forEach(rule => {
          if (rule.pattern.test(line)) {
            issues.push({
              type: 'security',
              severity: rule.severity,
              category: rule.category,
              title: rule.title,
              description: rule.description,
              file: relativePath,
              line: index + 1,
              code: line.trim(),
              suggestion: rule.suggestion,
              cwe: rule.cwe,
            });
          }
        });
      });
    } catch (e) {
      // 忽略文件读取错误
    }
  }
  
  function walkDir(dir: string) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      
      if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
      
      try {
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          walkDir(filePath);
        } else if (file.match(/\.(js|ts|jsx|tsx|py|java|go|php|rb|c|cpp|h|hpp)$/)) {
          scanFile(filePath);
        }
      } catch (e) {
        // 忽略错误
      }
    }
  }
  
  walkDir(repoPath);
  
  console.log(`✅ 安全扫描完成: 发现 ${issues.length} 个问题`);
  return issues;
}

// AI 分析
async function analyzeWithAI(repoPath: string, issues: Issue[], codeStats: any): Promise<string> {
  console.log(`🤖 AI 正在分析代码...`);
  
  try {
    // 读取关键文件（限制数量和大小）
    const keyFiles: string[] = [];
    const maxFiles = 5;
    const maxFileSize = 2000;
    
    function findKeyFiles(dir: string, depth: number = 0) {
      if (depth > 2 || keyFiles.length >= maxFiles) return;
      
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        if (keyFiles.length >= maxFiles) break;
        
        const filePath = path.join(dir, file);
        
        if (file === 'node_modules' || file === '.git') continue;
        
        try {
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            findKeyFiles(filePath, depth + 1);
          } else if (file.match(/\.(js|ts|jsx|tsx|py)$/) && stat.size < 50000) {
            keyFiles.push(filePath);
          }
        } catch (e) {
          // 忽略错误
        }
      }
    }
    
    findKeyFiles(repoPath);
    
    const codeContext = keyFiles.map(f => {
      const content = fs.readFileSync(f, 'utf-8');
      return {
        file: path.relative(repoPath, f),
        content: content.substring(0, maxFileSize),
      };
    });
    
    // 构建 AI 提示
    const prompt = `作为代码安全专家，请分析以下代码仓库的安全状况：

## 代码统计
- 文件数量：${codeStats.totalFiles}
- 代码行数：${codeStats.totalLines}
- 主要语言：${Object.entries(codeStats.filesByLanguage).map(([lang, count]) => `${lang}(${count})`).join(', ')}

## 已发现的安全问题
${issues.slice(0, 10).map((i, idx) => `${idx + 1}. ${i.title} (${i.severity}) - ${i.file}:${i.line}`).join('\n')}

## 代码示例
${codeContext.map(c => `### ${c.file}\n\`\`\`\n${c.content}\n\`\`\``).join('\n\n')}

请提供：
1. 整体安全评估（1-2句话）
2. 主要风险点（3-5个要点）
3. 优先修复建议（按优先级排序）
4. 最佳实践建议（2-3条）

请用中文回答，简洁明了，使用 Markdown 格式。`;
    
    // 调用 AI（使用现有的配置）
    const config = await getSystemConfig();
    if (!config.apiKey) {
      return '未配置 AI API Key，跳过 AI 分析。';
    }
    
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'accounts/fireworks/models/glm-5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });
    
    const data: any = await response.json();
    const aiInsights = data.choices?.[0]?.message?.content || '无法生成 AI 分析';
    
    console.log(`✅ AI 分析完成`);
    return aiInsights;
  } catch (error) {
    console.error('AI 分析错误:', error);
    return 'AI 分析失败，请检查 API 配置。';
  }
}

// Bug 类型定义
interface Bug {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  line: number;
  description: string;
  suggestion: string;
  confidence: number;
  file?: string;
  function?: string;
  cwe?: string;
}

// 深度代码分析（单线程 + 流式输出纯文本）
async function deepCodeAnalysis(repoPath: string, taskId: string): Promise<Bug[]> {
  console.log(`🔬 开始深度代码分析...`);
  
  let fullAnalysisOutput = '';
  
  try {
    const config = await getSystemConfig();
    if (!config.apiKey) {
      console.log('⚠️  未配置 API Key，跳过深度分析');
      return [];
    }
    
    // 第一步：让 AI 分析代码结构，找出核心文件
    updateAuditProgress(taskId, 40, 'analyzing', '正在分析代码结构，识别核心文件...');
    const coreFiles = await identifyCoreFiles(repoPath, config.apiKey);
    
    console.log(`📁 识别到 ${coreFiles.length} 个核心代码文件`);
    coreFiles.forEach((file, idx) => {
      console.log(`   ${idx + 1}. ${file}`);
    });
    
    if (coreFiles.length === 0) {
      console.log('⚠️  未找到核心代码文件');
      return [];
    }
    
    // 第二步：单线程分析每个核心文件
    for (let i = 0; i < coreFiles.length; i++) {
      const file = coreFiles[i];
      const progress = 50 + Math.floor((i / coreFiles.length) * 40);
      const fileName = path.basename(file);
      
      updateAuditProgress(
        taskId, 
        progress, 
        'analyzing', 
        `正在分析 ${fileName} (${i + 1}/${coreFiles.length})`,
        undefined,
        fullAnalysisOutput
      );
      
      console.log(`\n🔍 分析文件 [${i + 1}/${coreFiles.length}]: ${file}`);
      
      try {
        fullAnalysisOutput += `\n\n## 📄 文件 [${i + 1}/${coreFiles.length}]: ${path.relative(repoPath, file)}\n\n`;
        
        const fileOutput = await analyzeFileWithStreaming(file, config.apiKey, taskId);
        fullAnalysisOutput += fileOutput;
        
        // 更新实时输出
        updateAuditProgress(
          taskId, 
          progress, 
          'analyzing', 
          `正在分析 ${fileName} (${i + 1}/${coreFiles.length})`,
          undefined,
          fullAnalysisOutput
        );
        
        console.log(`   ✓ 分析完成`);
      } catch (error) {
        console.error(`   分析失败:`, error);
        fullAnalysisOutput += `\n❌ 错误: ${error}\n`;
      }
    }
    
    console.log(`\n✅ 深度分析完成`);
    
    // 解析文本输出，提取问题（用于报告）
    const bugs = parseTextOutputToBugs(fullAnalysisOutput, repoPath);
    return bugs;
    
  } catch (error) {
    console.error('深度分析失败:', error);
    return [];
  }
}

// 解析文本输出为 Bug 对象
function parseTextOutputToBugs(output: string, repoPath: string): Bug[] {
  const bugs: Bug[] = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    // 匹配格式: [SEVERITY] TYPE at line X: Description
    const match = line.match(/\[(critical|high|medium|low)\]\s+(\w+)\s+at\s+line\s+(\d+):\s+(.+)/i);
    if (match) {
      bugs.push({
        severity: match[1].toLowerCase() as any,
        type: match[2],
        line: parseInt(match[3]),
        description: match[4],
        suggestion: '',
        confidence: 0.8,
        file: '',
      });
    }
  }
  
  return bugs;
}

// 识别核心代码文件
async function identifyCoreFiles(repoPath: string, apiKey: string): Promise<string[]> {
  console.log(`🔍 分析代码结构...`);
  
  // 1. 扫描所有代码文件
  const allFiles: string[] = [];
  
  function scanDirectory(dir: string, depth: number = 0) {
    if (depth > 5) return; // 限制深度
    
    try {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        
        // 跳过特殊目录
        if (file === 'node_modules' || file === '.git' || file === 'dist' || 
            file === 'build' || file === 'vendor' || file === 'coverage' ||
            file === 'test' || file === 'tests' || file === '__tests__' ||
            file === 'CMakeFiles' || file === 'Debug' || file === 'Release') {
          continue;
        }
        
        try {
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            scanDirectory(filePath, depth + 1);
          } else if (file.match(/\.(c|cpp|cc|cxx|h|hpp|js|ts|jsx|tsx|py|java)$/)) {
            // 排除测试文件
            if (!file.match(/test|spec|mock/i)) {
              allFiles.push(path.relative(repoPath, filePath));
            }
          }
        } catch (error) {
          // 忽略错误
        }
      }
    } catch (error) {
      // 忽略错误
    }
  }
  
  scanDirectory(repoPath);
  
  console.log(`   找到 ${allFiles.length} 个代码文件（已排除测试）`);
  
  if (allFiles.length === 0) {
    return [];
  }
  
  // 2. 构建文件列表摘要
  const fileList = allFiles.slice(0, 200).join('\n'); // 最多 200 个文件
  
  // 3. 让 AI 识别核心文件
  const prompt = `Select the most important core source files from this list (exclude tests, examples, tools).

Files:
${fileList}

Return JSON only:
{"core_files":["PCIeSMAPI/file1.cpp","PCIeSMAPI/file2.c"],"reason":"why"}

Select 10-15 most critical files.`;
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'accounts/fireworks/models/glm-5',
        messages: [
          {
            role: 'system',
            content: 'Return ONLY valid JSON. No explanations. Format: {"core_files":["path1","path2"],"reason":"text"}',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 800,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });
    
    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log(`   AI 原始响应: ${content.substring(0, 300)}`);
    
    // 直接解析 JSON（response_format 已强制 JSON 模式）
    let parsed: any;
    try {
      parsed = JSON.parse(content);
      console.log(`   解析成功: ${JSON.stringify(parsed).substring(0, 200)}`);
    } catch (parseError: any) {
      console.error('   JSON 解析失败，使用降级方案', parseError.message);
      console.log('   使用降级方案：选择前 15 个文件');
      return allFiles.slice(0, 15).map(f => path.join(repoPath, f));
    }
    
    console.log(`   AI 选择原因: ${parsed.reason || '未提供'}`);
    
    // 转换为绝对路径
    const coreFiles = (parsed.core_files || [])
      .map((f: string) => {
        // 处理相对路径
        const fullPath = path.join(repoPath, f);
        const exists = fs.existsSync(fullPath);
        console.log(`   检查文件: ${f} -> ${exists ? '存在' : '不存在'}`);
        return exists ? fullPath : null;
      })
      .filter((f: string | null) => f !== null) as string[];
    
    if (coreFiles.length === 0) {
      console.log('   AI 未选择任何文件，使用降级方案');
      return allFiles.slice(0, 15).map(f => path.join(repoPath, f));
    }
    
    return coreFiles;
    
  } catch (error) {
    console.error('AI 识别核心文件失败:', error);
    // 降级：返回前 15 个文件
    console.log('   使用降级方案：选择前 15 个文件');
    return allFiles.slice(0, 15).map(f => path.join(repoPath, f));
  }
}

// 分析单个文件（流式输出 Markdown）
async function analyzeFileWithStreaming(
  filePath: string, 
  apiKey: string, 
  taskId: string
): Promise<string> {
  let fullOutput = '';
  
  try {
    // 读取文件内容
    const code = fs.readFileSync(filePath, 'utf-8');
    const lines = code.split('\n');
    
    // 如果文件太大，分块处理
    const maxLines = 500;
    if (lines.length > maxLines) {
      console.log(`   文件较大 (${lines.length} 行)，分块分析...`);
      
      // 分成多个块
      const chunks: string[] = [];
      for (let i = 0; i < lines.length; i += maxLines) {
        chunks.push(lines.slice(i, i + maxLines).join('\n'));
      }
      
      // 分析每个块
      for (let i = 0; i < chunks.length; i++) {
        const chunkOutput = await analyzeCodeChunk(chunks[i], filePath, i * maxLines, apiKey, taskId);
        fullOutput += `\n#### 代码块 ${i + 1}/${chunks.length} (第 ${i * maxLines + 1}-${Math.min((i + 1) * maxLines, lines.length)} 行)\n\n${chunkOutput}\n`;
        
        // 实时更新到前端
        updateAuditProgress(taskId, 0, 'analyzing', '', undefined, fullOutput);
      }
    } else {
      // 直接分析整个文件
      fullOutput = await analyzeCodeChunk(code, filePath, 0, apiKey, taskId);
      
      // 实时更新到前端
      updateAuditProgress(taskId, 0, 'analyzing', '', undefined, fullOutput);
    }
    
  } catch (error) {
    console.error(`读取文件失败 ${filePath}:`, error);
    fullOutput = `❌ 读取文件失败: ${error}`;
  }
  
  return fullOutput;
}

// 分析代码块（返回 Markdown 格式）
async function analyzeCodeChunk(
  code: string, 
  filePath: string, 
  lineOffset: number, 
  apiKey: string,
  taskId: string
): Promise<string> {
  const prompt = `分析以下 C/C++ 代码的安全问题，用中文回答。

文件：${path.basename(filePath)}

\`\`\`cpp
${code.substring(0, 3000)}
\`\`\`

请检测：
1. 内存泄漏（malloc/new 未释放）
2. 空指针解引用
3. 缓冲区溢出
4. 资源竞争
5. 逻辑错误

用 Markdown 格式输出，每个问题格式如下：

### 🔴 [严重程度] 问题类型 - 第 X 行

**问题描述：** 详细说明问题

**修复建议：** 如何修复

---

如果没有问题，输出：✅ 未发现安全问题`;
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'accounts/fireworks/models/glm-5',
        messages: [
          {
            role: 'system',
            content: '你是专业的代码安全分析专家。用中文分析代码，输出 Markdown 格式。',
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
    
    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || '❌ AI 未返回分析结果';
    
    return content;
    
  } catch (error) {
    console.error('   分析代码块失败:', error);
    return `❌ 分析失败: ${error}`;
  }
}

// 获取系统配置
async function getSystemConfig() {
  try {
    const configPath = path.join(process.cwd(), 'data', 'system-config.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      const provider = config.providers?.[config.selectedProvider];
      const selectedApiKey = provider?.apiKeys?.find((k: any) => k.id === config.selectedApiKey);
      
      return {
        apiKey: selectedApiKey?.key || null,
      };
    }
  } catch (error) {
    console.error('读取系统配置失败:', error);
  }
  
  return { apiKey: null };
}

// 生成报告
async function generateReport(taskId: string, data: any) {
  console.log(`📝 生成审计报告...`);
  
  const { codeStats, securityIssues, aiInsights } = data;
  
  // 统计问题数量
  const summary = {
    totalIssues: securityIssues.length,
    criticalIssues: securityIssues.filter((i: Issue) => i.severity === 'critical').length,
    highIssues: securityIssues.filter((i: Issue) => i.severity === 'high').length,
    mediumIssues: securityIssues.filter((i: Issue) => i.severity === 'medium').length,
    lowIssues: securityIssues.filter((i: Issue) => i.severity === 'low').length,
    filesScanned: codeStats.totalFiles,
    linesOfCode: codeStats.totalLines,
  };
  
  // 保存报告
  await prisma.auditReport.create({
    data: {
      taskId,
      ...summary,
      issues: JSON.stringify(securityIssues),
      metrics: JSON.stringify(codeStats),
      aiInsights,
    },
  });
  
  console.log(`✅ 报告生成完成`);
}

// 清理临时文件
async function cleanupRepository(repoPath: string) {
  try {
    console.log(`🧹 清理临时文件: ${repoPath}`);
    
    // Windows 上需要等待一下，确保文件句柄释放
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 尝试多次删除（Windows 上可能需要重试）
    let retries = 3;
    while (retries > 0) {
      try {
        fs.rmSync(repoPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
        console.log(`✅ 清理完成`);
        break;
      } catch (error: any) {
        retries--;
        if (retries === 0) {
          console.warn(`⚠️  清理失败（文件可能被占用）: ${error.message}`);
          console.warn(`   临时文件位置: ${repoPath}`);
          console.warn(`   请手动删除或等待系统自动清理`);
        } else {
          console.log(`   重试清理... (剩余 ${retries} 次)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  } catch (error) {
    console.error('清理失败:', error);
  }
}

// 主处理函数
export async function processAudit(taskId: string) {
  let repoPath: string | null = null;
  
  try {
    // 获取任务信息
    const task = await prisma.auditTask.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new Error('任务不存在');
    }
    
    console.log(`\n🚀 开始审计任务: ${task.repoName}`);
    
    // 1. 克隆仓库
    updateAuditProgress(taskId, 10, 'cloning', '正在克隆仓库...');
    repoPath = await cloneRepository(task.repoUrl, task.branch);
    
    // 2. 分析代码结构
    updateAuditProgress(taskId, 30, 'analyzing', '正在分析代码结构...');
    const codeStats = await analyzeCodeStructure(repoPath);
    
    // 3. 安全扫描
    updateAuditProgress(taskId, 35, 'analyzing', '正在扫描安全漏洞...');
    const securityIssues = await scanSecurity(repoPath);
    
    // 4. 深度代码分析（AST + LLM）
    const deepAnalysisIssues = await deepCodeAnalysis(repoPath, taskId);
    
    // 合并问题列表
    const allIssues = [
      ...securityIssues,
      ...deepAnalysisIssues.map((bug: any) => ({
        type: 'quality' as const,
        severity: bug.severity,
        category: bug.type,
        title: `[${bug.type}] ${bug.description}`,
        description: bug.description,
        file: bug.file || '',
        line: bug.line,
        code: '',
        suggestion: bug.suggestion,
        cwe: bug.cwe,
        confidence: bug.confidence,
        function: bug.function,
      })),
    ];
    
    // 5. AI 总结分析
    updateAuditProgress(taskId, 85, 'analyzing', 'AI 正在生成总结报告...');
    const aiInsights = await analyzeWithAI(repoPath, allIssues, codeStats);
    
    // 6. 生成报告
    updateAuditProgress(taskId, 95, 'analyzing', '正在生成报告...');
    await generateReport(taskId, { codeStats, securityIssues: allIssues, aiInsights });
    
    // 6. 完成
    updateAuditProgress(taskId, 100, 'completed', '审计完成！');
    await prisma.auditTask.update({
      where: { id: taskId },
      data: { endTime: new Date() },
    });
    
    console.log(`✅ 审计任务完成: ${task.repoName}\n`);
    
  } catch (error: any) {
    console.error('❌ 审计任务失败:', error);
    updateAuditProgress(taskId, 0, 'failed', `审计失败: ${error.message}`);
    await prisma.auditTask.update({
      where: { id: taskId },
      data: { 
        status: 'failed',
        error: error.message,
        endTime: new Date(),
      },
    });
  } finally {
    // 清理临时文件
    if (repoPath) {
      await cleanupRepository(repoPath);
    }
    
    // 5分钟后清理进度数据
    setTimeout(() => {
      auditProgress.delete(taskId);
    }, 5 * 60 * 1000);
  }
}
