# 代码审计功能说明

## 功能概述

基于 LLM 的深度代码审计系统，采用 **AI 识别核心文件 + 单线程流式分析** 的架构，能够检测：

- **内存泄漏**：资源（文件句柄、连接、内存）分配后未释放，异常路径是否有泄漏
- **逻辑错误**：边界条件、空指针/NULL检查、整数溢出、错误的控制流
- **资源竞争**：多线程场景下的共享状态问题
- **缓冲区溢出**：不安全的字符串操作、数组越界
- **安全漏洞**：SQL注入、XSS、命令注入、硬编码密钥等

## 技术架构

```
GitHub URL → 代码拉取 → AI识别核心文件 → 单线程深度分析 → 流式输出问题 → 报告
```

### 核心模块

1. **AuditService** (`auditService.ts`)
   - 仓库克隆和管理
   - AI 识别核心代码文件（排除测试）
   - 单线程深度分析
   - 流式输出问题点
   - 规则扫描（正则匹配）
   - 报告生成

## 工作流程

### 1. 代码拉取
```typescript
// 支持 HTTPS 和 SSH 格式
// 支持私有仓库（通过 token）
const repoPath = await cloneRepository(repoUrl, branch, token);
```

### 2. 代码结构分析
```typescript
// 扫描所有代码文件
// 统计文件数量、代码行数、语言分布
const codeStats = await analyzeCodeStructure(repoPath);
```

### 3. 规则扫描
```typescript
// 使用正则表达式快速扫描常见安全问题
// - SQL 注入
// - 硬编码密钥
// - XSS 漏洞
// - 命令注入
// - 弱加密算法
const securityIssues = await scanSecurity(repoPath);
```

### 4. AI 识别核心文件
```typescript
// 让 AI 分析文件列表，识别核心实现文件
// 排除测试、示例、配置文件
// 最多选择 20 个最重要的文件
const coreFiles = await identifyCoreFiles(repoPath, apiKey);
```

### 5. 单线程深度分析
```typescript
// 逐个分析核心文件
for (const file of coreFiles) {
  // 读取文件内容
  // 如果文件太大（>500行），分块处理
  const bugs = await analyzeFileWithStreaming(file, apiKey, taskId);
  
  // 实时输出发现的问题
  bugs.forEach(bug => {
    console.log(`⚠️  [${bug.severity}] ${bug.type} at line ${bug.line}`);
  });
}
```

### 6. AI 总结分析
```typescript
// AI 生成整体安全评估
// - 主要风险点
// - 优先修复建议
// - 最佳实践建议
const aiInsights = await analyzeWithAI(repoPath, allIssues, codeStats);
```

### 7. 报告生成
```typescript
// 聚合所有问题
// 按严重程度分类
// 保存到数据库
await generateReport(taskId, { codeStats, securityIssues: allIssues, aiInsights });
```

## 分析策略

### 文件选择策略
```typescript
// AI 自动识别核心文件
// 排除测试文件（test|spec|mock）
// 排除特殊目录（node_modules、dist、build、vendor、coverage）
// 优先选择主要源文件（.c/.cpp/.js/.ts 等）
// 最多选择 20 个最重要的文件
```

### 单线程分析
```typescript
// 逐个分析文件，避免并发导致的 API 限流
// 如果文件 > 500 行，分块处理
// 每个块独立分析，避免超出 Token 限制
```

### 流式输出
```typescript
// 实时输出发现的问题
// 用户可以立即看到分析进度
// 不需要等待所有分析完成
```

### 置信度过滤
```typescript
// 只报告置信度 >= 0.7 的问题
// 减少误报
bugs = bugs.filter(bug => bug.confidence >= 0.7);
```

## 提示词设计

### 核心文件识别提示词
```
你是代码架构分析专家。请分析以下代码仓库的文件列表，识别出核心实现文件（不包括测试、示例、配置文件）。

文件列表：
...

请返回 JSON 格式：
{
  "core_files": [
    "path/to/core/file1.cpp",
    "path/to/core/file2.c"
  ],
  "reason": "选择这些文件的原因"
}

要求：
1. 只选择核心业务逻辑和关键功能实现
2. 排除测试、示例、工具脚本
3. 优先选择主要的源文件（.c/.cpp/.js/.ts 等）
4. 最多选择 20 个最重要的文件
5. 只返回 JSON，不要其他内容
```

### 代码分析提示词
```
你是一个专业的代码安全和质量分析专家。分析以下代码，重点检测：

1. **内存泄漏**：资源（文件句柄、连接、内存）分配后未释放，异常路径是否有泄漏
2. **逻辑错误**：边界条件、空指针/NULL检查、整数溢出、错误的控制流
3. **资源竞争**：多线程场景下的共享状态问题
4. **缓冲区溢出**：不安全的字符串操作、数组越界
5. **安全漏洞**：SQL注入、命令注入、格式化字符串漏洞

【文件】filename.c

【代码】
```
...code...
```

请以 JSON 格式返回：
{
  "bugs": [
    {
      "type": "memory_leak|logic_error|race_condition|buffer_overflow|security",
      "severity": "critical|high|medium|low",
      "line": <行号>,
      "description": "问题描述",
      "suggestion": "修复建议",
      "confidence": 0.0-1.0
    }
  ]
}

要求：
- 只返回 JSON
- 只报告真正的问题
- confidence >= 0.7
- 如果没有问题，返回空数组
```

### AI 总结提示词
```
作为代码安全专家，请分析以下代码仓库的安全状况：

## 代码统计
- 文件数量：...
- 代码行数：...
- 主要语言：...

## 已发现的安全问题
1. ...
2. ...

## 代码示例
...

请提供：
1. 整体安全评估（1-2句话）
2. 主要风险点（3-5个要点）
3. 优先修复建议（按优先级排序）
4. 最佳实践建议（2-3条）

请用中文回答，简洁明了，使用 Markdown 格式。
```

## 性能优化

### 1. AI 智能选择
- AI 自动识别核心文件
- 最多分析 20 个文件
- 避免分析无关文件

### 2. 单线程执行
- 避免并发导致的 API 限流
- 更稳定可靠
- 实时输出进度

### 3. 分块处理
- 大文件（>500行）自动分块
- 每块独立分析
- 避免超出 Token 限制

### 4. 置信度过滤
- 只报告 confidence >= 0.7 的问题
- 减少误报
- 提高报告质量

## 扩展支持

### 支持的语言

当前支持：
- C/C++ (.c, .cpp, .cc, .cxx, .h, .hpp)
- JavaScript/TypeScript (.js, .ts, .jsx, .tsx)
- Python (.py)
- Java (.java)

AI 可以分析任何文本格式的代码，无需特殊的解析器。

### 自定义规则

在 `auditService.ts` 的 `scanSecurity()` 函数中添加：
```typescript
const customRules = [
  {
    pattern: /your-pattern/gi,
    severity: 'high',
    category: 'Custom',
    title: '自定义规则',
    description: '...',
    suggestion: '...',
    cwe: 'CWE-XXX',
  },
];
```

## 使用示例

### 基本使用
```typescript
import { processAudit } from './services/auditService';

// 创建审计任务
const task = await prisma.auditTask.create({
  data: {
    repoUrl: 'https://github.com/user/repo',
    repoName: 'user/repo',
    branch: 'main',
    userId: 'user-id',
  },
});

// 开始审计
await processAudit(task.id);
```

### 监控进度
```typescript
import { getAuditProgress } from './services/auditService';

const progress = getAuditProgress(taskId);
console.log(progress);
// { progress: 50, status: 'analyzing', message: '...' }
```

## 最佳实践

1. **合理设置并发数**：根据 API 限制调整
2. **调整置信度阈值**：平衡准确率和召回率
3. **启用二次审查**：减少误报
4. **定期清理临时文件**：避免磁盘占用
5. **监控 API 使用量**：避免超限

## 已知限制

1. **文件数量限制**：最多分析 20 个核心文件
2. **文件大小限制**：单个文件 >500 行会分块处理
3. **分析时间**：大型仓库可能需要 10-30 分钟
4. **API 成本**：每个文件约消耗 1000-2000 tokens
5. **单线程执行**：无法并发分析，速度较慢

## 未来改进

- [ ] 支持并发分析（带智能限流）
- [ ] 增量分析（只分析变更部分）
- [ ] 结果缓存（避免重复分析）
- [ ] 自定义规则引擎
- [ ] 交互式修复建议
- [ ] 集成到 CI/CD 流程
- [ ] 支持更多 Git 服务（Gitee、Coding 等）
