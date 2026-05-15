# Tasks

## 1. 后端：新增深度验证路由和 Prompt

- [x] 1.1 在 `server/prompts/decisionModel.js` 新增 `DECISION_VALIDATE_PROMPT`，约束 LLM 保持 options/weights 不变，补充 sim_spec、扩展路径、进行温和对抗性审查
- [x] 1.2 在 `server/routes/decision.js` 新增 `POST /deep-validation` 路由，接收 `{ currentModel, userInput }`，调用 LLM 并返回增强后的模型
- [x] 1.3 添加 Mock 模式支持（当 `USE_REAL_LLM=false` 时返回模拟数据）

## 2. 前端：新增 API 调用和 Composable 方法

- [x] 2.1 在 `src/api/decision.js` 新增 `deepValidation(currentModel, userInput)` 方法
- [x] 2.2 在 `src/composables/useDecisionModel.js` 新增 `runDeepValidation()` 方法，调用 API → sanitizeModel → adaptTree → 更新 state → 自动触发蒙特卡洛仿真和 DEVIL 审查
- [x] 2.3 在 `src/composables/useDecisionModel.js` 新增 `resetModel()` 方法，清空当前模型数据但保留 userInput

## 3. 前端 UI 改造

- [x] 3.1 在 `src/components/decision/InputPanel.vue` 将"提交建模"按钮文案改为"快速建模"
- [x] 3.2 在 `src/components/decision/ParamPanel.vue` 移除"深度模拟"按钮及其相关逻辑
- [x] 3.3 在 `src/views/DecisionView.vue` 将"多 Agent 流水线"按钮改为"深度验证"，绑定 `runDeepValidation()`
- [x] 3.4 在 `src/views/DecisionView.vue` 添加"重新生成模型"弱入口（小链接或次要按钮，绑定 `resetModel()`）

## 4. 状态清理和兼容性

- [x] 4.1 检查并移除 `runDeepSimulation()` 中不再需要的 UI 触发路径（保留内部调用）
- [x] 4.2 确认 `/full-pipeline` 路由保持向后兼容（不被移除，但主 UI 不再使用）
- [x] 4.3 更新 DevilReview 组件中"请先运行深度模拟"提示文案为"请先快速建模"
