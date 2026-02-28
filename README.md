# 公司内部AI平台

## 项目简介

企业级AI应用平台，集成多种AI功能，提供统一的用户管理、权限控制、日志审计等企业级特性。

## 技术栈

### 前端
- React 18 + TypeScript
- Ant Design 5.x
- React Router 6
- Zustand (状态管理)
- TanStack Query (数据请求)
- Recharts (数据可视化)
- Vite (构建工具)

### 后端
- Node.js + Express + TypeScript
- PostgreSQL (关系数据库)
- Redis (缓存)
- MongoDB (日志存储)
- Prisma (ORM)
- JWT (认证)

### AI集成
- OpenAI API
- LangChain

## 项目结构

```
ai-platform/
├── frontend/          # 前端项目
├── backend/           # 后端项目
├── docker/            # Docker配置
└── docs/              # 文档
```

## 快速开始

### 前端开发
```bash
cd frontend
npm install
npm run dev
```

### 后端开发
```bash
cd backend
npm install
npm run dev
```

### Docker部署
```bash
docker-compose up -d
```

## 功能模块

- ✅ 用户认证与授权
- ✅ 用户管理
- ✅ 角色权限管理
- ✅ AI对话功能
- ✅ 文档分析
- ✅ 知识库管理
- ✅ 日志管理
- ✅ 系统配置
- ✅ 数据统计

## 环境变量配置

参考 `.env.example` 文件配置环境变量

## License

MIT
