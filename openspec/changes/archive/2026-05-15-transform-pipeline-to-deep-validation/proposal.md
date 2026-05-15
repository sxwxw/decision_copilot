## 为什么

当前系统有 3 个并列入口（提交建模、多 Agent 流水线、深度模拟），用户困惑"该点哪个"。核心问题不是按钮数量，而是**用户的决策状态无法继承**——每次深入分析都像进入另一个世界，多 Agent 完全无视已有模型另起炉灶，破坏了用户对"同一个决策正在持续推演"的信任感。

## 变更内容

- **去掉"深度模拟"按钮** — 其功能（带 sim_spec 的深度建模 + 蒙特卡洛 + DEVIL 审查）并入改造后的"深度验证"流程
- **多 Agent 流水线 → 深度验证** — 从"重新生成模型"改为"基于当前模型的增强推演"：保留已有 options/weights，补充 sim_spec、修复审查发现的漏洞、扩展路径、进行对抗性审查
- **新增"重新生成模型"弱入口** — 用于用户对当前模型完全不满意时重开分析，入口放在设置或底部区域，不影响主流程
- **精简为 2 个主按钮**：快速建模 + 深度验证，形成"建模 → 调参 → 验证"的渐进式路径

## 功能 (Capabilities)

### 新增功能
- `deep-validation`: 基于已有模型的深度验证能力，接收当前模型数据作为上下文，输出增强后的模型 + 蒙特卡洛仿真 + DEVIL 审查 + 综合报告

### 修改功能
- `decision-core`: 移除独立的深度模拟入口，主入口从 3 个改为 2 个（快速建模 + 深度验证）

## 影响

- `src/views/DecisionView.vue` — 移除多 Agent 主按钮，替换为"深度验证"按钮；新增"重新生成模型"弱入口
- `src/components/decision/ParamPanel.vue` — 移除"深度模拟"按钮
- `src/components/decision/InputPanel.vue` — 主按钮文案调整
- `server/routes/decision.js` — 新增 `/deep-validation` 路由，接收当前模型上下文；或修改 `/full-pipeline` 支持可选的 `currentModel` 参数
- `server/prompts/decisionModel.js` — 新增 `DECISION_VALIDATE_PROMPT`（深度验证专用 prompt，基于已有模型做增强）
- `src/composables/useDecisionModel.js` — 新增 `runDeepValidation()` 方法，移除或改造 `runPipeline()`

## 非目标

- 不改变蒙特卡洛仿真、DEVIL 审查、敏感性分析的核心逻辑
- 不改变快速建模的 prompt 和接口
- 不改变参数面板的交互方式
