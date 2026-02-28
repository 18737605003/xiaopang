# 新版代码审计测试指南

## ✅ 服务状态

- 后端：http://localhost:3000 ✓
- 前端：http://localhost:5173/ ✓
- 数据库：已连接 ✓

## 🎯 核心改进

### 1. 放弃 JSON 格式
- AI 不再需要返回严格的 JSON
- 直接返回纯文本分析结果
- 避免 JSON 解析错误

### 2. 实时流式输出
- 分析结果实时显示在前端
- 用户可以立即看到 AI 的分析过程
- 不需要等待所有分析完成

### 3. 更简单的提示词
```
Analyze this C/C++ code for security issues:

File: example.cpp

Find:
1. Memory leaks
2. Null pointer dereferences
3. Buffer overflows
4. Race conditions
5. Logic errors

Report format:
[SEVERITY] TYPE at line X: Description
Suggestion: How to fix
```

### 4. 前端显示
- 进度条
- 当前状态消息
- **实时 AI 分析输出**（滚动文本框）
- 完成后自动打开报告

## 🧪 测试步骤

### 1. 打开浏览器
访问：http://localhost:5173/

### 2. 登录系统
- 用户名：`admin`
- 密码：`admin123`

### 3. 配置 API Key
1. 进入"系统设置"页面
2. 配置 Fireworks AI API Key
3. 保存配置

### 4. 提交审计任务
1. 进入"代码审计"页面
2. 输入测试仓库 URL

**推荐测试仓库**：
```
https://github.com/koajs/koa
```
或
```
git@192.168.19.20:mmbpro/pciesm/tassapi4pciesm.git
```

3. 选择分支（main 或 master）
4. 点击"开始审计"

### 5. 观察实时输出

提交后会弹出进度对话框，显示：

1. **进度条**（0-100%）
2. **状态消息**（正在分析 xxx.cpp）
3. **实时 AI 分析输出**（滚动文本框）

实时输出示例：
```
========================================
文件 [1/15]: PCIeSMAPI/CMConditionVariable.cpp
========================================

[HIGH] memory_leak at line 42: malloc without free
Suggestion: Add free() before function returns

[MEDIUM] null_pointer_dereference at line 58: ptr not checked
Suggestion: Add NULL check before dereferencing

[LOW] code_style at line 65: Missing braces
Suggestion: Add braces for better readability

No issues found.

========================================
文件 [2/15]: PCIeSMAPI/CMError.cpp
========================================
...
```

### 6. 查看报告

审计完成后会自动打开报告，包含：
- 概览：问题统计、代码统计
- 问题列表：详细的问题信息
- AI 洞察：整体评估和建议

## 📊 预期结果

### 小型仓库（koa）
- 时间：3-5 分钟
- 文件：10-15 个核心文件
- 问题：5-20 个

### 中型仓库（express）
- 时间：10-15 分钟
- 文件：15 个核心文件
- 问题：20-50 个

### 私有仓库（tassapi4pciesm）
- 时间：10-20 分钟
- 文件：15 个核心文件
- 问题：根据代码质量而定

## 🔍 调试技巧

### 查看后端日志
后端控制台会显示：
```
📁 识别到 15 个核心代码文件
   1. PCIeSMAPI/file1.cpp
   2. PCIeSMAPI/file2.cpp
   ...

🔍 分析文件 [1/15]: ...
   ✓ 分析完成

✅ 深度分析完成
```

### 查看前端实时输出
前端对话框会实时显示 AI 的分析结果，包括：
- 文件名
- 发现的问题
- 严重程度
- 修复建议

### 常见问题

**Q: 没有实时输出？**
A: 检查后端日志，确认 AI 是否正在分析

**Q: 分析时间太长？**
A: 正常，每个文件需要 30-60 秒

**Q: 没有发现任何问题？**
A: 可能代码质量很好，或者 AI 认为没有严重问题

**Q: 审计失败？**
A: 检查：
1. API Key 是否配置正确
2. 仓库 URL 是否可访问
3. 分支名称是否正确
4. 后端日志中的错误信息

## 🎉 优势

### 相比旧版本

| 特性 | 旧版本 | 新版本 |
|------|--------|--------|
| JSON 解析 | 经常失败 | 不需要 JSON |
| 实时反馈 | 无 | 有 |
| 用户体验 | 等待时间长 | 实时看到进展 |
| 错误处理 | 容易崩溃 | 更稳定 |
| 调试难度 | 困难 | 容易 |

### 技术优势

1. **更可靠**：不依赖 AI 返回严格的 JSON 格式
2. **更直观**：用户可以实时看到 AI 的分析过程
3. **更灵活**：AI 可以自由表达，不受 JSON 格式限制
4. **更易调试**：文本输出更容易理解和调试

## 📝 注意事项

1. **API 成本**：每个文件约消耗 1000-2000 tokens
2. **分析时间**：大型仓库可能需要 20-30 分钟
3. **文件限制**：最多分析 15 个核心文件
4. **单线程**：逐个分析文件，避免 API 限流

## 🚀 下一步

测试完成后，可以：
1. 查看生成的报告
2. 导出报告（未来功能）
3. 集成到 CI/CD（未来功能）
4. 自定义规则（未来功能）

## 📞 反馈

如果遇到问题：
1. 查看后端日志
2. 查看前端控制台
3. 检查 API Key 配置
4. 尝试不同的测试仓库
