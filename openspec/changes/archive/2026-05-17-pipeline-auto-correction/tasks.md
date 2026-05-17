# 实现任务清单

## 1. 后端：内回路基础设施

- [x] 1.1 在 `server/utils/sanitizeDevilReview.js` 实现纯 JS 协议防御函数 `sanitizeDevilReview`：解析 LLM 原始响应，容错处理 requires_refactor/severity/directives 字段，CRITICAL + 有指令时强制激活 requires_refactor
- [x] 1.2 修改 `server/prompts/decisionModel.js` 中 `DECISION_DEVIL_MODEL_PROMPT`：强制输出结构化 JSON（requires_refactor, severity, directives 数组），提供 TypeScript Interface 风格的 schema 约束

## 2. 后端：内回路（Inner Loop）

- [x] 2.1 修改 `server/prompts/decisionModel.js` 中 `DECISION_DEVIL_MODEL_PROMPT`：强制输出结构化 JSON（requires_refactor, severity, target_dimension, reason, suggested_value_range, directives 数组）
- [x] 2.2 在 `executePipelineSteps` 的 devil-model 步骤后调用 `sanitizeDevilReview` 解析 LLM 返回
- [x] 2.3 实现内回路回溯逻辑：当 `requires_refactor: true` 且 `severity === 'CRITICAL'` 时，将修正指令注入 build-model prompt，重新执行 build-model
- [x] 2.4 内回路计数器：记录执行次数，超过 1 次标记 `inner-loop-skipped` 继续下游

## 3. 后端：外回路（Outer Loop）

- [x] 3.1 在 `executePipelineSteps` 中实现败因上下文提炼函数（defeatContext）：扫描 4 个 devil 步骤的 high/critical 条目 + MC 结果，生成精炼指令
- [x] 3.2 实现外回路触发逻辑：nexus 完成后检查 confidence_level < 60，构建败因上下文
- [x] 3.3 实现裁剪版 3 步重跑：build-model（含败因上下文注入）→ simulate（MonteCarlo）→ nexus，跳过 4 个 Devil 步骤
- [x] 3.4 外回路计数器：超过 1 次不再重跑，管线以当前结果完成
- [x] 3.5 新增 `POST /api/decision/correct-model` 路由：从 pipelineState 读取上下文执行手动修正

## 4. 前端：处理回路结果

- [x] 4.1 在 `src/api/decision.js` 新增 `correctModel(pipelineId)` API 调用
- [x] 4.2 在 `src/composables/useDecisionModel.js` 的 `runPipeline` 完成回调中处理回路重跑后的模型替换（V1 → V2 切换）
- [x] 4.3 新增 `runModelCorrection()` 方法：调用 /correct-model API，加载修正后模型并更新 UI

## 5. 前端：UI 反馈

- [x] 5.1 在 `src/components/decision/PipelineProgress.vue` 中显示内回路/外回路状态（inner-loop-running / outer-loop-evolving / skipped）
- [x] 5.2 在 `src/components/decision/NexusReport.vue` 中，置信度 < 60% 时显示"模型正在自我重塑"提示
- [x] 5.3 在管线完成后添加"重新建模"手动修正按钮
- [x] 5.4 在 `DecisionView.vue` 中将 `v-loading` 的 `element-loading-text` 改为动态绑定：正常推演 / 内回路校准 / 外回路重塑显示不同文案

## 6. 校验与清理

- [x] 6.1 确认修正后的模型（V2）通过 validateModel 校验（correct-model API 和 runModelCorrection 均调用）
- [x] 6.2 确认 local storage 在 V2 完成后正确更新（SSE 回调和 runModelCorrection 均调用 saveToStorage）
- [ ] 6.3 端到端测试：输入决策问题，观察内回路/外回路行为及 UI 反馈
