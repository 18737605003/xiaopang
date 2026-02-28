# 代码审计功能实现总结

## 实现概述

已成功实现基于 LLM 的代码审计系统，采用 **AI 识别核心文件 + 单线程流式分析** 的架构。

## 核心特性

### 1. AI 智能识别核心文件
- 自动分析代码仓库结构
- 识别核心业务逻辑文件
- 排除测试、示例、配置文件
- 最多选择 20 个最重要的文件

### 2. 单线程深度分析
- 逐个分析核心文件，避免 API 限流
- 大文件（>500行）自动分块处理
- 实时输出发现的问题
- 置信度过滤（>= 0.7）

### 3. 多层次检测

#### 规则扫描（正则匹配）
- SQL 注入
- 硬编码密钥
- XSS 漏洞
- 命令注入
- 弱加密算法
- 不安全的 eval 使用

#### AI 深度分析
- 内存泄漏（资源未释放）
- 逻辑错误（边界条件、空指针）
- 资源竞争（多线程问题）
- 缓冲区溢出（C/C++ 代码）
- 复杂的安全漏洞

### 4. 实时进度反馈
- SSE 实时推送进度
- 显示当前分析的文件
- 实时显示最近发现的 10 个问题
- 进度条和状态消息

### 5. 详细报告
- 问题按严重程度分类
- 每个问题包含：
  - 文件位置和行号
  - 问题描述
  - 代码片段
  - 修复建议
  - CWE 编号
- AI 生成的整体评估和建议

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React)                          │
│  - 提交审计任务                                               │
│  - SSE 接收实时进度                                           │
│  - 显示实时问题列表                                           │
│  - 查看详细报告                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     后端 API (Express)                       │
│  - POST /api/audit/submit - 提交任务                         │
│  - GET /api/audit/progress/:id - SSE 进度推送                │
│  - GET /api/audit/report/:id - 获取报告                      │
│  - GET /api/audit/branches - 获取分支列表                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   审计服务 (auditService.ts)                 │
│                                                              │
│  1. cloneRepository() - 克隆仓库                             │
│  2. analyzeCodeStructure() - 分析代码结构                    │
│  3. scanSecurity() - 规则扫描                                │
│  4. identifyCoreFiles() - AI 识别核心文件                    │
│  5. deepCodeAnalysis() - 深度分析                            │
│     ├─ analyzeFileWithStreaming() - 分析单个文件             │
│     └─ analyzeCodeChunk() - 分析代码块                       │
│  6. analyzeWithAI() - AI 总结                                │
│  7. generateReport() - 生成报告                              │
│  8. cleanupRepository() - 清理临时文件                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    LLM API (Fireworks AI)                    │
│  - 识别核心文件                                               │
│  - 分析代码问题                                               │
│  - 生成总结报告                                               │
└─────────────────────────────────────────────────────────────┘
```

## 文件结构

```
backend/
├── src/
│   ├── services/
│   │   └── auditService.ts          # 核心审计服务
│   └── routes/
│       └── audit.ts                 # 审计 API 路由
├── CODE_AUDIT_README.md             # 功能说明文档
└── AUDIT_TEST_GUIDE.md              # 测试指南

frontend/
└── src/
    ├── pages/
    │   └── CodeAudit/
    │       └── index.tsx             # 审计页面
    └── api/
        └── audit.ts                  # 审计 API 客户端
```

## 关键代码

### 1. AI 识别核心文件
```typescript
async function identifyCoreFiles(repoPath: string, apiKey: string): Promise<string[]> {
  // 1. 扫描所有代码文件（排除测试、node_modules 等）
  const allFiles = scanDirectory(repoPath);
  
  // 2. 构建文件列表
  const fileList = allFiles.slice(0, 200).join('\n');
  
  // 3. 让 AI 识别核心文件
  const prompt = `分析文件列表，识别核心实现文件...`;
  const response = await callLLM(prompt);
  
  // 4. 解析 JSON 结果
  const coreFiles = JSON.parse(response).core_files;
  
  return coreFiles;
}
```

### 2. 单线程深度分析
```typescript
async function deepCodeAnalysis(repoPath: string, taskId: string): Promise<Bug[]> {
  const coreFiles = await identifyCoreFiles(repoPath, apiKey);
  const allBugs: Bug[] = [];
  const realtimeIssues: Array<any> = [];
  
  // 单线程逐个分析
  for (let i = 0; i < coreFiles.length; i++) {
    const file = coreFiles[i];
    
    // 更新进度
    updateAuditProgress(taskId, progress, 'analyzing', `正在分析 ${file}...`);
    
    // 分析文件
    const bugs = await analyzeFileWithStreaming(file, apiKey, taskId);
    allBugs.push(...bugs);
    
    // 更新实时问题列表
    realtimeIssues.push(...bugs.map(bug => ({
      severity: bug.severity,
      type: bug.type,
      file: bug.file,
      line: bug.line,
      description: bug.description,
    })));
    
    // 推送实时问题
    updateAuditProgress(taskId, progress, 'analyzing', message, realtimeIssues.slice(-10));
  }
  
  return allBugs;
}
```

### 3. 分析代码块
```typescript
async function analyzeCodeChunk(code: string, filePath: string, lineOffset: number, apiKey: string): Promise<Bug[]> {
  const prompt = `
你是一个专业的代码安全和质量分析专家。分析以下代码，重点检测：

1. **内存泄漏**：资源分配后未释放
2. **逻辑错误**：边界条件、空指针检查
3. **资源竞争**：多线程场景问题
4. **缓冲区溢出**：不安全的字符串操作
5. **安全漏洞**：SQL注入、命令注入等

【代码】
${code}

返回 JSON 格式：
{
  "bugs": [{
    "type": "memory_leak|logic_error|...",
    "severity": "critical|high|medium|low",
    "line": <行号>,
    "description": "问题描述",
    "suggestion": "修复建议",
    "confidence": 0.0-1.0
  }]
}
`;
  
  const response = await callLLM(prompt);
  const bugs = JSON.parse(response).bugs.filter(bug => bug.confidence >= 0.7);
  
  // 实时输出
  bugs.forEach(bug => {
    console.log(`⚠️  [${bug.severity}] ${bug.type} at line ${bug.line}`);
  });
  
  return bugs;
}
```

### 4. 前端实时显示
```typescript
eventSource.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  
  // 更新实时问题列表
  if (progress.issues && progress.issues.length > 0) {
    realtimeIssues = progress.issues;
  }
  
  // 更新 UI
  progressModal.update({
    content: (
      <div>
        <Progress percent={progress.progress} />
        <div>{progress.message}</div>
        
        {/* 实时问题列表 */}
        {realtimeIssues.length > 0 && (
          <List
            dataSource={realtimeIssues}
            renderItem={(issue) => (
              <List.Item>
                <Tag color={getSeverityColor(issue.severity)}>{issue.severity}</Tag>
                <Text>{issue.file}:{issue.line}</Text>
                <Text>{issue.description}</Text>
              </List.Item>
            )}
          />
        )}
      </div>
    ),
  });
};
```

## 提示词设计

### 识别核心文件
```
你是代码架构分析专家。请分析以下代码仓库的文件列表，识别出核心实现文件（不包括测试、示例、配置文件）。

文件列表：
...

请返回 JSON 格式：
{
  "core_files": ["path/to/file1.c", "path/to/file2.cpp"],
  "reason": "选择这些文件的原因"
}

要求：
1. 只选择核心业务逻辑和关键功能实现
2. 排除测试、示例、工具脚本
3. 优先选择主要的源文件
4. 最多选择 20 个最重要的文件
5. 只返回 JSON，不要其他内容
```

### 分析代码
```
你是一个专业的代码安全和质量分析专家。分析以下代码，重点检测：

1. **内存泄漏**：资源（文件句柄、连接、内存）分配后未释放，异常路径是否有泄漏
2. **逻辑错误**：边界条件、空指针/NULL检查、整数溢出、错误的控制流
3. **资源竞争**：多线程场景下的共享状态问题
4. **缓冲区溢出**：不安全的字符串操作、数组越界
5. **安全漏洞**：SQL注入、命令注入、格式化字符串漏洞

【文件】filename.c
【代码】
...

请以 JSON 格式返回：
{
  "bugs": [{
    "type": "memory_leak|logic_error|race_condition|buffer_overflow|security",
    "severity": "critical|high|medium|low",
    "line": <行号>,
    "description": "问题描述",
    "suggestion": "修复建议",
    "confidence": 0.0-1.0
  }]
}

要求：
- 只返回 JSON
- 只报告真正的问题
- confidence >= 0.7
- 如果没有问题，返回空数组
```

## 性能优化

### 1. AI 智能选择
- 只分析核心文件，避免浪费 API 调用
- 最多 20 个文件，控制成本

### 2. 单线程执行
- 避免并发导致的 API 限流
- 更稳定可靠

### 3. 分块处理
- 大文件（>500行）自动分块
- 避免超出 Token 限制

### 4. 置信度过滤
- 只报告 confidence >= 0.7 的问题
- 减少误报

## 测试建议

### 小型仓库（快速测试）
- https://github.com/koajs/koa
- 预期时间：3-5 分钟
- 预期问题：5-15 个

### 中型仓库（完整测试）
- https://github.com/expressjs/express
- 预期时间：10-15 分钟
- 预期问题：20-50 个

### C/C++ 代码（专项测试）
- https://github.com/redis/redis
- 预期时间：15-30 分钟
- 预期问题：30-100 个

## 已知限制

1. **文件数量限制**：最多分析 20 个核心文件
2. **文件大小限制**：单个文件 >500 行会分块处理
3. **单线程执行**：无法并发分析，速度较慢
4. **API 成本**：每个文件约消耗 1000-2000 tokens

## 未来改进方向

1. **并发分析**：支持多个文件并发分析（带智能限流）
2. **增量分析**：只分析变更的文件
3. **结果缓存**：避免重复分析相同的代码
4. **自定义规则**：允许用户添加自定义检测规则
5. **导出报告**：支持导出 PDF/HTML 格式的报告
6. **CI/CD 集成**：提供 API 接口，集成到 CI/CD 流程

## 相关文档

- `backend/CODE_AUDIT_README.md` - 功能说明文档
- `backend/AUDIT_TEST_GUIDE.md` - 测试指南
- `backend/src/services/auditService.ts` - 核心实现代码
