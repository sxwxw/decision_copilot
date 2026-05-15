## 1. 后端：扩展 /full-pipeline 支持 currentModel

- [x] 1.1 修改 `/full-pipeline` 路由，接收可选的 `currentModel` 参数，有值时标记为深度验证模式
- [x] 1.2 修改 FRAMEWORK 步骤 prompt，注入 currentModel 的 options 和 variables 作为参考
- [x] 1.3 修改 MODEL-BUILD 步骤 prompt，约束 options/weights 与 currentModel 一致
- [x] 1.4 修改 NEXUS 步骤 prompt，注入 currentModel 用于结构一致性校验
- [x] 1.5 验证深度验证模式下 SSE 推送正常，步骤名称与原有流水线一致

## 2. 清理：移除 /deep-validation 单步路由

- [x] 2.1 从 `server/routes/decision.js` 移除 `/deep-validation` 路由
- [x] 2.2 从 `server/prompts/decisionModel.js` 移除 `DECISION_VALIDATE_PROMPT`（深度验证版，245 行）
- [x] 2.3 从 `src/api/decision.js` 移除 `deepValidation` 导出函数

## 3. 前端：runDeepValidation 复用 runPipeline

- [x] 3.1 修改 `runDeepValidation()` 改为调用 `runPipeline()`，传入 userInput + currentModel
- [x] 3.2 从 `useDecisionModel.js` 移除不再需要的 `deepValidation` 相关逻辑
- [x] 3.3 验证 PipelineProgress 组件在深度验证模式下标题显示为"深度验证"
- [x] 3.4 验证 PipelineProgress 组件标题从"多 Agent 流水线"改为"深度验证"
