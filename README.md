# 9527剧本平台 MVP

面向短剧、漫剧团队的剧本创作、剧本资产管理、AI 评分与积分运营平台。

## 技术栈

- 前端：Next.js + React + TypeScript
- 后端：NestJS + TypeScript
- 数据库：PostgreSQL + Prisma
- 缓存/任务队列：Redis + BullMQ
- 文件：本地导出优先，后续接入 OSS/COS/S3
- AI：统一 AI Gateway 抽象，便于切换模型

## 核心模块

- 剧本管理：搜索、试读、状态、独占锁定、下载 txt/md
- 剧本创作：框架引导、AI 推荐、一键生成、分步骤长文本生成
- 剧本评分：冲突强度、AI 率、逻辑完整性、节奏、商业潜力
- 积分系统：创作得分、使用消耗、充值/调整、流水追踪
- 后台管理：用户、剧本、审核、积分、AI 配置、系统配置

## 快速开始

```bash
npm install
cp .env.example .env
docker compose up -d postgres redis
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

前端默认：http://localhost:3000

后端默认：http://localhost:4000

## 目录

```text
apps/web      用户端和管理端 MVP 页面
apps/api      NestJS API 骨架
prisma        数据模型
docs          产品和架构文档
infra         部署配置
```

## MVP 边界

第一阶段聚焦完整闭环：

创作 -> 评分 -> 审核 -> 上架 -> 试读 -> 锁定 -> 下载 -> 使用追踪 -> 积分结算。
