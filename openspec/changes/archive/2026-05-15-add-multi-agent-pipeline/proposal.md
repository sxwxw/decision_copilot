## 为什么

当前单一 LLM 一次性生成整棵决策树，如果 LLM 在某个环节（权重分配、路径概率估计）出错，整个模型偏斜。无中间校验点。

## 变更内容

将单一 LLM 建模拆分为 5 步流水线：FRAMEWORK → MODEL-BUILD → SIMULATE → DEVIL → NEXUS。每步独立校验，支持断点续跑。新增 SSE 流式进度推送。

## 功能 (Capabilities)

### 新增功能

- `multi-agent-pipeline`: 5 步 Agent 流水线，支持断点续跑和 SSE 进度推送。SSE 推送功能在此能力范围内，不单独拆分

### 修改功能

- `backend-api`: 新增多个路由端点（/framework, /build-model, /full-pipeline）

## 影响

- `server/routes/decision.js` 新增 5 个路由端点
- `server/prompts/decisionModel.js` 新增 FRAMEWORK、NEXUS prompts
- 前端新增流水线进度展示组件
