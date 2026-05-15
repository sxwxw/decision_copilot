## 1. 后端 Prompt 定义

- [x] 1.1 在 `server/prompts/decisionModel.js` 新增 `DECISION_DEVIL_FRAMEWORK_PROMPT` — 攻击问题定义、选项穷举性、中间路径
- [x] 1.2 在 `server/prompts/decisionModel.js` 新增 `DECISION_DEVIL_MODEL_PROMPT` — 攻击变量/权重/因果/重复加权/命名偏差
- [x] 1.3 在 `server/prompts/decisionModel.js` 新增 `DECISION_DEVIL_SIMULATE_PROMPT` — 攻击概率假设/均值依据/极端风险
- [x] 1.4 在 `server/prompts/decisionModel.js` 新增 `DECISION_DEVIL_NEXUS_PROMPT` — 生成条件化结论（前提依赖/敏感性/失效条件）

## 2. 后端流水线步骤改造

- [x] 2.1 修改 `server/routes/decision.js` `PIPELINE_STEPS` 数组，从 5 步扩展为 8 步：framework → devil-framework → build-model → devil-model → simulate → devil-simulate → devil-nexus → nexus
- [x] 2.2 修改 `executePipelineSteps` 中的 userPrompt 构造逻辑，为 4 个 DEVIL 步骤分别构建针对性上下文（传入前置步骤输出）
- [x] 2.3 添加 DEVIL 步骤的 Mock 模式支持（返回模拟审查数据）

## 3. 前端进度组件适配

- [x] 3.1 修改 `src/components/decision/PipelineProgress.vue`，DEVIL 步骤隐藏 UI，后台运行（与主步骤视觉区分）
- [x] 3.2 确认进度条支持 8 步序列的正确展示

## 4. 前端审查面板改造

- [x] 4.1 新建 `src/components/decision/DevilReview.vue`，按阶段分组展示 4 个 DEVIL 输出（FRAMEWORK / MODEL / SIMULATE / NEXUS）
- [x] 4.2 在 `src/views/DecisionView.vue` 中通过 `pipelineDevil` computed 聚合 DEVIL 步骤输出传递到底部面板
