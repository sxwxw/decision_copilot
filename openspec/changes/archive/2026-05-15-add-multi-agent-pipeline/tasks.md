## 1. 服务端流水线端点

- [x] 1.1 在 `server/prompts/decisionModel.js` 中新增 `DECISION_FRAMEWORK_PROMPT` 和 `DECISION_NEXUS_PROMPT`
- [x] 1.2 在 `server/routes/decision.js` 中新增 POST `/framework` 路由
- [x] 1.3 新增 POST `/build-model` 路由（替代现有 /model 的多 Agent 版本）
- [x] 1.4 新增 POST `/full-pipeline` 路由，使用 SSE 推送进度

## 2. 流水线状态管理

- [x] 2.1 实现 `pipelineState` 对象，存储每步结果
- [x] 2.2 实现断点续跑逻辑

## 3. 前端进度展示

- [x] 3.1 新增流水线进度条组件
- [x] 3.2 实现 EventSource 连接，接收 SSE 事件
- [x] 3.3 在 DecisionView.vue 中集成进度展示
