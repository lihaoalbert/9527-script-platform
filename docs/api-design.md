# API 设计草案

## 剧本

- `GET /scripts?q=&status=`：剧本列表搜索。
- `GET /scripts/:id/preview`：查看前 10% 或最多 1000 字试读。
- `POST /scripts`：创建剧本草稿。
- `POST /scripts/:id/lock`：消耗积分并独占锁定剧本。

## AI

- `POST /ai/outline`：根据题材和设定生成大纲建议。
- `POST /ai/score`：分析冲突、逻辑、节奏、商业潜力和 AI 率。

## 积分

- `GET /credits/:userId`：查看积分账户。
- `POST /credits/:userId/adjust`：管理员调整积分并写入流水。

## 下一阶段接口

- `POST /scripts/:id/download`：导出 txt/md。
- `POST /scripts/:id/submit-review`：提交审核。
- `POST /admin/scripts/:id/publish`：审核上架。
- `POST /ai/generate-script`：创建长文本生成任务。
- `GET /ai/tasks/:id`：查询生成进度。
