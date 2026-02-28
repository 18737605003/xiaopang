# 代码审计调试指南

## 常见错误及解决方案

### 1. JSON 解析错误

#### 错误信息
```
SyntaxError: Unterminated fractional number in JSON at position 2
SyntaxError: Unexpected end of JSON input
```

#### 原因
AI 返回的 JSON 格式不正确，可能包含：
- 未终止的小数（如 `0.` 而不是 `0.0`）
- 不完整的 JSON 对象
- 多余的逗号
- 缺少引号的键名

#### 解决方案
已实现增强的 JSON 解析函数 `parseAIResponse()`，包含多层容错机制：

1. **第一层**：直接解析
2. **第二层**：提取 JSON 对象并修复常见错误
   - 移除尾随逗号
   - 修复小数点格式
   - 移除换行符
3. **第三层**：激进修复
   - 确保键名有引号
   - 清理所有空白字符

#### 调试步骤

1. **查看原始响应**
   ```bash
   # 后端日志会显示：
   JSON 解析失败: ...
   原始内容: {"bugs":[...
   ```

2. **检查 AI 返回内容**
   - 是否包含完整的 JSON？
   - 是否有格式错误？
   - 是否有多余的文字说明？

3. **手动测试解析**
   ```typescript
   const content = '你的 AI 返回内容';
   const parsed = parseAIResponse(content);
   console.log(parsed);
   ```

### 2. API 限流错误

#### 错误信息
```
429 Too Many Requests
```

#### 原因
- 请求频率过高
- 超出 API 配额

#### 解决方案
1. 降低并发数（已设置为单线程）
2. 增加请求间延迟
3. 使用不同的 API Key
4. 升级 API 套餐

### 3. 文件分析失败

#### 错误信息
```
分析文件失败: ...
```

#### 原因
- 文件太大（>500行会分块）
- 文件编码问题
- API 超时

#### 解决方案
1. **检查文件大小**
   ```typescript
   const lines = code.split('\n').length;
   console.log(`文件行数: ${lines}`);
   ```

2. **调整分块大小**
   ```typescript
   // 在 analyzeFileWithStreaming() 中
   const maxLines = 500; // 可以调整为 300 或 200
   ```

3. **增加超时时间**
   ```typescript
   // 在 fetch() 调用中添加
   signal: AbortSignal.timeout(60000) // 60秒超时
   ```

### 4. 核心文件识别失败

#### 错误信息
```
未找到核心代码文件
使用降级方案：选择前 10 个文件
```

#### 原因
- AI 返回的 JSON 格式错误
- 文件路径不存在
- 没有符合条件的文件

#### 解决方案
1. **查看 AI 选择原因**
   ```bash
   # 后端日志会显示：
   AI 选择原因: ...
   ```

2. **检查降级方案**
   - 降级会自动选择前 10 个文件
   - 查看这些文件是否合理

3. **手动指定核心文件**（可选）
   ```typescript
   // 在 identifyCoreFiles() 中添加
   const manualCoreFiles = [
     'src/main.c',
     'src/core.cpp',
     // ...
   ];
   ```

## 调试技巧

### 1. 启用详细日志

在 `auditService.ts` 中添加更多日志：

```typescript
console.log('📝 AI 请求:', prompt.substring(0, 200));
console.log('📝 AI 响应:', content.substring(0, 200));
console.log('📝 解析结果:', JSON.stringify(parsed, null, 2));
```

### 2. 保存 AI 响应到文件

```typescript
import fs from 'fs';

// 保存响应
fs.writeFileSync(
  `debug-response-${Date.now()}.json`,
  content,
  'utf-8'
);
```

### 3. 使用 Postman 测试 API

```bash
POST https://api.fireworks.ai/inference/v1/chat/completions
Headers:
  Authorization: Bearer YOUR_API_KEY
  Content-Type: application/json

Body:
{
  "model": "accounts/fireworks/models/glm-5",
  "messages": [
    {
      "role": "system",
      "content": "你必须只返回有效的 JSON 格式"
    },
    {
      "role": "user",
      "content": "分析代码..."
    }
  ],
  "max_tokens": 2000,
  "temperature": 0.3
}
```

### 4. 检查数据库

```bash
cd backend
npx prisma studio
```

查看：
- `AuditTask` 表 - 任务状态
- `AuditReport` 表 - 报告内容
- `issues` 字段 - JSON 格式的问题列表

## 性能优化建议

### 1. 调整分块大小

如果经常遇到 JSON 解析错误，可以减小分块大小：

```typescript
// 在 analyzeFileWithStreaming() 中
const maxLines = 300; // 从 500 改为 300
```

### 2. 调整置信度阈值

如果发现太多误报，可以提高阈值：

```typescript
// 在 analyzeCodeChunk() 中
.filter((bug: any) => bug.confidence >= 0.8) // 从 0.7 改为 0.8
```

### 3. 限制核心文件数量

如果分析时间太长，可以减少文件数量：

```typescript
// 在 identifyCoreFiles() 提示词中
最多选择 10 个最重要的文件 // 从 20 改为 10
```

### 4. 使用更简单的提示词

如果 AI 经常返回格式错误的 JSON，可以简化提示词：

```typescript
const prompt = `分析代码，返回 JSON：{"bugs":[]}`;
```

## 测试用例

### 测试 JSON 解析

```typescript
// 测试用例 1：正常 JSON
const test1 = '{"bugs":[{"type":"memory_leak","severity":"high","line":10,"description":"test","suggestion":"fix","confidence":0.8}]}';
console.log(parseAIResponse(test1));

// 测试用例 2：带 markdown
const test2 = '```json\n{"bugs":[]}\n```';
console.log(parseAIResponse(test2));

// 测试用例 3：尾随逗号
const test3 = '{"bugs":[{"type":"test",}]}';
console.log(parseAIResponse(test3));

// 测试用例 4：小数点错误
const test4 = '{"bugs":[{"confidence":0.}]}';
console.log(parseAIResponse(test4));
```

### 测试文件分析

```typescript
// 创建测试文件
const testCode = `
int main() {
  int *ptr = malloc(100);
  // 忘记 free(ptr)
  return 0;
}
`;

const bugs = await analyzeCodeChunk(testCode, 'test.c', 0, apiKey);
console.log('发现的问题:', bugs);
```

## 联系支持

如果问题仍然存在：

1. 收集以下信息：
   - 错误日志（完整的堆栈跟踪）
   - AI 返回的原始内容
   - 测试的仓库 URL
   - 系统配置（API Key 提供商、模型）

2. 检查：
   - API Key 是否有效
   - 网络连接是否正常
   - 磁盘空间是否充足

3. 尝试：
   - 重启后端服务
   - 清理临时文件（`backend/temp/`）
   - 使用不同的测试仓库
