# 代码审计功能快速启动指南

## 1. 启动服务

### 后端
```bash
cd backend
npm run dev
```

### 前端
```bash
cd frontend
npm run dev
```

## 2. 配置 API Key

1. 打开浏览器访问 http://localhost:5173
2. 登录系统（admin/admin123）
3. 进入"系统设置"页面
4. 配置 Fireworks AI API Key
5. 点击"保存配置"

## 3. 提交审计任务

1. 进入"代码审计"页面
2. 输入 Git 仓库 URL（例如：`https://github.com/koajs/koa`）
3. 等待系统自动获取分支列表
4. 选择分支（通常是 `main` 或 `master`）
5. 点击"开始审计"

## 4. 观察进度

提交后会弹出进度对话框，实时显示：
- 进度条（0-100%）
- 当前状态和消息
- 最近发现的 10 个问题（实时更新）

## 5. 查看报告

审计完成后会自动打开报告，包含：
- 概览：问题统计、代码统计
- 问题列表：详细的问题信息
- AI 洞察：整体评估和建议

## 推荐测试仓库

### 快速测试（3-5 分钟）
```
https://github.com/koajs/koa
```

### 完整测试（10-15 分钟）
```
https://github.com/expressjs/express
```

### C/C++ 测试（15-30 分钟）
```
https://github.com/redis/redis
```

## 常见问题

### Q: 进度卡住不动？
A: 检查 API Key 是否配置正确，查看后端控制台日志

### Q: 没有发现任何问题？
A: 查看"AI 洞察"标签，看 AI 的整体评估

### Q: 审计失败？
A: 检查仓库 URL 和分支名称是否正确，查看后端日志

## 更多信息

- 功能说明：`backend/CODE_AUDIT_README.md`
- 测试指南：`backend/AUDIT_TEST_GUIDE.md`
- 实现总结：`AUDIT_IMPLEMENTATION_SUMMARY.md`
