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

AI创作 Studio（`/studio`）以 AI 对话为核心的三栏布局：

- **左栏**：项目文件导航（AI 生成的内容自动保存为文件）
- **中栏**：AI 对话区，支持切换”编剧小Q”和”审核官”两个 AI 角色
- **右栏**：文件预览/结果展示
- 布局自适应屏幕宽度，左右各 15px 留白
- 窄屏（<860px）自动折叠为单栏对话模式
- **自动模式**：点击"自动"按钮，@编剧小Q 和 @审核官 自主交替协作，评分 ≥90 自动进入下一步。规划阶段逐项推进，分集阶段每集 5000 字，默认 5 集后暂停。多项目可同时跑自动模式。
- **手动模式**（默认）：用户全程参与，可随时切换角色、插入意见、呼叫审核官

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

**Studio（项目制创作）：**
- `POST /studio/projects` — 创建项目
- `GET /studio/projects` — 项目列表（按 ownerId/status 筛选）
- `GET /studio/projects/:id` — 项目详情（plan + episodes + messageCount）
- `PATCH /studio/projects/:id` — 更新项目元数据
- `DELETE /studio/projects/:id` — 归档项目
- `POST /studio/projects/:id/chat` — 发送消息，触发 AI 响应
- `GET /studio/projects/:id/messages` — 对话历史（分页）
- `POST /studio/projects/:id/advance` — 推进规划步骤
- `POST /studio/projects/:id/lock-plan` — 锁定规划书，进入阶段二
- `PATCH /studio/projects/:id/plan` — 直接更新规划字段
- `GET /studio/projects/:id/episodes` — 分集列表
- `GET /studio/projects/:id/episodes/:epNum` — 单集详情
- `POST /studio/projects/:id/episodes/:epNum/force-lock` — 强制锁定

**剧本/积分/AI 原有端点：**
- `GET /scripts` / `POST /scripts` / `GET /scripts/:id/preview` / `POST /scripts/:id/lock`
- `GET /credits/:userId` / `POST /credits/:userId/adjust`
- `POST /ai/outline` / `POST /ai/generate-script` / `POST /ai/score` / `POST /ai/review`

## 项目记忆架构

每个 Project 的对话支持跨数周/月的长期协作，使用四层记忆注入：

- **Layer 0**: System Prompt（固定角色 + 阶段指引）
- **Layer 1**: 项目宪法 — 锁定后的规划书摘要（~3000 tokens）
- **Layer 2**: 当前阶段状态 + 待决策事项（~1000 tokens）
- **Layer 3**: 最近 30 条对话原文（~4000 tokens）
- **Layer 4**: 历史阶段 AI 自动摘要（~2000 tokens）

总上下文控制在 ~12,000 tokens，远低于 Deepseek V4 Pro 的 1M 上下文窗口。

## 代码关注点

Studio 核心（项目制创作）：
- [apps/api/src/modules/studio/studio.service.ts] — 核心业务逻辑
- [apps/api/src/modules/studio/memory.service.ts] — 分层记忆管理
- [apps/api/src/modules/studio/personas.ts] — 编剧小Q / 审核官 System Prompt
- [apps/api/src/modules/studio/studio.controller.ts] — API 控制器
- [apps/web/src/app/studio/page.tsx] — Studio 前端页面

前端主页面：
- [apps/web/src/app/page.tsx]  → 重定向到 /dashboard
- [apps/web/src/app/dashboard/page.tsx] — 仪表盘（工作台）

前端样式：
- [apps/web/src/app/styles.css]

AI 服务：
- [apps/api/src/modules/ai/ai.service.ts]

剧本服务：
- [apps/api/src/modules/scripts/scripts.service.ts]

## 后续优先级

1. 增加剧本详情页，不再只在首页试读。
2. 接通 `txt / md` 下载。
3. 补登录和角色权限。
4. 完善 @审核官 和 @编剧小Q 的 PK 对话流（双方自动交替发言）。
5. 给 AI 提示词做后台配置页。

## 协作约定

- 优先保持 AI 创作模块为产品主入口。
- 不要再把所有业务模块继续堆回单页。
- 新增功能时，优先拆成独立视图或独立工作区。
- 涉及数据库结构变更时，先评估是否影响 seed 脚本。
- 如果修改前端信息架构，优先维护“创作优先、管理次之”的布局逻辑。
