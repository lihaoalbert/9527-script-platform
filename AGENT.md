# 9527 剧本平台协作说明

## 项目定位

`9527剧本平台` 是一个面向短剧、漫剧内容团队的剧本创作与运营平台。

当前 MVP 的核心闭环：

1. AI 辅助创作剧本。
2. 剧本进入剧本库管理。
3. 用户试读、锁定、后续下载。
4. AI 评分辅助筛选与改写。
5. 积分体系串联创作和使用。

## 当前技术栈

- 前端：`Next.js` + `React` + `TypeScript`
- 后端：`NestJS` + `TypeScript`
- 数据库：`PostgreSQL` + `Prisma`
- AI：`Deepseek V4 Pro` (`deepseek-v4-pro`，API: `https://api.deepseek.com/v1/chat/completions`)
- Redis：`BullMQ` 队列（本地 `localhost:6379`）
- 当前远程数据库：阿里云 PostgreSQL

## 关键运行方式

根目录常用命令：

- `npm install`
- `npm run prisma:generate`
- `npm run db:seed`
- `npm run dev`
- `npm run build`
- `npm run typecheck`

前端默认：

- `http://127.0.0.1:3000`

后端默认：

- `http://127.0.0.1:4000`

## 环境配置

本地 `.env` 当前已指向云数据库。

注意：

- 该 PostgreSQL 当前不支持 TLS。
- `DATABASE_URL` 不要带 `sslmode=require`。
- 如果后续更换云库，先验证 `Prisma db pull` 是否能通，再执行 `db push`。

## 当前数据库状态

数据库已经完成初始化，包含：

- 4 个演示用户
- 2 个演示剧本
- 3 条 AI 提示词配置

初始化脚本：

- [prisma/seed.cjs](</Users/Shared/Previously Relocated Items/Security/lihao app/app/9527/prisma/seed.cjs:1>)

## 前端页面结构

当前首页已经从”单页堆叠控件”调整为工作台结构。

主结构：

1. 顶部：产品定位与创作入口
2. Hero 区：创作主张 + 核心指标
3. `AI创作 Studio`：平台第一优先模块
4. 下半区：剧本库、积分、后台视图

AI创作 Studio 当前分为三栏：

1. 左栏：阶段导航、题材预设
2. 中栏：项目 brief、大纲生成
3. 右栏：草案输出、评分润色

### Studio V2（`/studio-v2`）

新版三栏创作工作室，以 AI 对话为核心：

- **左栏**：项目文件导航（AI 生成的内容自动保存为文件）
- **中栏**：AI 对话区，支持切换”编剧小Q”和”审核官”两个 AI 角色
- **右栏**：文件预览/结果展示
- 布局自适应屏幕宽度，左右各 15px 留白
- 窄屏（<860px）自动折叠为单栏对话模式

目标是让创作者清楚知道：

- 现在在做哪一步
- 下一步该点什么
- AI 输出会落到哪里

## AI 模型变更记录

- **2026-05-21**：AI 从 MiniMax (`MiniMax-M2.7`) 迁移到 Deepseek V4 Pro (`deepseek-v4-pro`)
  - API 端点：`https://api.deepseek.com/v1/chat/completions`
  - 响应格式与 OpenAI 兼容
  - 旧模型 `deepseek-chat` 将于 2026-07-24 弃用，已提前使用新模型名

## 当前 API 能力

已接通：

- `GET /scripts`
- `GET /scripts/:id/preview`
- `POST /scripts`
- `POST /scripts/:id/lock`
- `GET /credits/:userId`
- `POST /credits/:userId/adjust`
- `POST /ai/outline`
- `POST /ai/generate-script`
- `POST /ai/score`

根路由：

- `GET /`
- 返回当前 API 状态和运行模式

## 代码关注点

前端主页面：

- [apps/web/src/app/page.tsx](</Users/Shared/Previously Relocated Items/Security/lihao app/app/9527/apps/web/src/app/page.tsx:1>)

前端样式：

- [apps/web/src/app/styles.css](</Users/Shared/Previously Relocated Items/Security/lihao app/app/9527/apps/web/src/app/styles.css:1>)

AI 服务：

- [apps/api/src/modules/ai/ai.service.ts](</Users/Shared/Previously Relocated Items/Security/lihao app/app/9527/apps/api/src/modules/ai/ai.service.ts:1>)

剧本服务：

- [apps/api/src/modules/scripts/scripts.service.ts](</Users/Shared/Previously Relocated Items/Security/lihao app/app/9527/apps/api/src/modules/scripts/scripts.service.ts:1>)

## 后续优先级

优先做：

1. 把 AI 创作从单次输出升级为分步骤保存。
2. 增加剧本详情页，不再只在首页试读。
3. 接通 `txt / md` 下载。
4. 补登录和角色权限。
5. 给 AI 提示词做后台配置页。

## 协作约定

- 优先保持 AI 创作模块为产品主入口。
- 不要再把所有业务模块继续堆回单页。
- 新增功能时，优先拆成独立视图或独立工作区。
- 涉及数据库结构变更时，先评估是否影响 seed 脚本。
- 如果修改前端信息架构，优先维护“创作优先、管理次之”的布局逻辑。
