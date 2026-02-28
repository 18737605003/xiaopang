# 代码审计功能快速参考

## 🚀 快速启动

### 服务状态
- ✅ 后端：http://localhost:3000
- ✅ 前端：http://localhost:5173/
- ✅ 数据库：已连接

### 登录信息
- 用户名：`admin`
- 密码：`admin123`

## 📋 使用步骤

1. **配置 API Key**
   - 进入"系统设置"
   - 配置 Fireworks AI API Key
   - 保存

2. **提交审计**
   - 进入"代码审计"
   - 输入仓库 URL
   - 选择分支
   - 开始审计

3. **观察进度**
   - 实时查看 AI 分析输出
   - 等待完成（3-30 分钟）

4. **查看报告**
   - 自动打开报告
   - 查看问题列表
   - 阅读 AI 洞察

## 🧪 测试仓库

### 快速测试（3-5 分钟）
```
https://github.com/koajs/koa
```

### 完整测试（10-15 分钟）
```
https://github.com/expressjs/express
```

### 私有仓库
```
git@192.168.19.20:mmbpro/pciesm/tassapi4pciesm.git
```

## 📊 输出格式

### 实时输出示例
```
========================================
文件 [1/15]: CMConditionVariable.cpp
========================================

[HIGH] memory_leak at line 42: malloc without free
Suggestion: Add free() before function returns

[MEDIUM] null_pointer_dereference at line 58: ptr not checked
Suggestion: Add NULL check before dereferencing

No issues found.
```

## 🔍 检测类型

1. **内存泄漏**：malloc/new 未释放
2. **空指针**：未检查 NULL
3. **缓冲区溢出**：不安全的字符串操作
4. **资源竞争**：多线程问题
5. **逻辑错误**：边界条件、整数溢出

## ⚙️ 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 最大文件数 | 15 | AI 识别的核心文件数 |
| 分块大小 | 500 行 | 大文件分块阈值 |
| 置信度 | 0.7 | 问题报告阈值 |
| Temperature | 0.3 | AI 温度参数 |

## 📁 重要文件

- `backend/src/services/auditService.ts` - 核心服务
- `frontend/src/pages/CodeAudit/index.tsx` - 前端页面
- `backend/CODE_AUDIT_README.md` - 功能说明
- `FINAL_SUMMARY.md` - 完整总结

## 🐛 常见问题

### Q: 没有实时输出？
A: 检查后端日志，确认 AI 正在分析

### Q: 分析时间太长？
A: 正常，每个文件需要 30-60 秒

### Q: 没有发现问题？
A: 可能代码质量很好

### Q: 审计失败？
A: 检查 API Key、仓库 URL、分支名称

## 📞 调试命令

### 查看后端日志
后端控制台会显示详细日志

### 查看数据库
```bash
cd backend
npx prisma studio
```

### 清理临时文件
```bash
cd backend/temp
rm -rf audit-*
```

## 🎯 核心优势

- ✅ 不依赖 JSON 格式
- ✅ 实时流式输出
- ✅ 更可靠稳定
- ✅ 更好的用户体验

## 📚 文档索引

1. `QUICK_START.md` - 快速启动
2. `TEST_NEW_AUDIT.md` - 测试指南
3. `FINAL_SUMMARY.md` - 完整总结
4. `backend/CODE_AUDIT_README.md` - 功能说明
5. `backend/AUDIT_DEBUG_GUIDE.md` - 调试指南

---

**现在可以开始测试了！** 🚀

访问：http://localhost:5173/
