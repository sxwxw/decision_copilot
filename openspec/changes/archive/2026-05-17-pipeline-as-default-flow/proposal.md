## 为什么

当前"快速建模"仅靠单次 LLM 调用生成决策模型，无自我审查环节，输出质量完全依赖一次 prompt 效果。多 Agent 流水线已通过 8 步编排（含 4 轮对抗审查）实现更可靠的建模，但隐藏在"深度验证"按钮下，用户默认使用质量较低的快速建模。应将管线设为唯一入口，确保每个决策问题都经过交叉验证。

## 变更内容

- 移除"快速建模"入口（InputPanel 提交按钮直接触发管线，而非单次 LLM 调用）
- 移除 DecisionView 中的"深度验证"按钮
- 管线以 quick-build 模式（无 currentModel）作为默认行为启动
- 清理 buildModel、runDeepValidation 及相关引用
- 将蒙特卡洛仿真从前端移至后端 `simulate` 步骤，使 devil-simulate/nexus 能消费仿真结果
- 管线失败时明确报错，不降级到快速建模

**非目标**：不改变管线内部步骤逻辑、prompt 内容或 LLM 调用方式。仅改变触发入口和默认行为。

## 功能 (Capabilities)

### 新增功能

- `monte-carlo-backend`: 将蒙特卡洛仿真引擎集成到后端管线 simulate 步骤，使后续 devil-simulate 和 nexus 能基于真实仿真结果进行审查和综合评估

### 修改功能

- `decision-core`: 输入提交行为由"单次建模"改为"管线触发"；移除"快速建模"和"深度验证"按钮
- `multi-agent-pipeline`: 从可选深度验证升级为默认唯一入口

## 影响

- `src/components/decision/InputPanel.vue` — 提交事件改为触发管线
- `src/views/DecisionView.vue` — 移除"深度验证"按钮，简化触发链路
- `src/composables/useDecisionModel.js` — 移除 buildModel 函数（保留管线相关逻辑）
- `server/routes/decision.js` — 独立建模路由 `/framework`、`/build-model` 保留用于开发调试，但不再作为用户可见入口
