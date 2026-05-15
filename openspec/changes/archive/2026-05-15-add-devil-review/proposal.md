## 为什么

当前 Copilot 没有任何机制质疑 LLM 自己生成的模型。如果 LLM 给某个选项打了虚高的初始分，或漏掉了关键变量，用户只能依赖自己发现。这降低了推荐的可信度。

## 变更内容

新增 DEVIL（对抗性审查）Agent，在深度模拟完成后自动运行，输出挑战列表、偏置标志、冠军脆弱假设。前端新增"审查"面板展示结果。

## 功能 (Capabilities)

### 新增功能

- `devil-review`: 对抗性审查 Agent，输出 challenges、bias_flags、winner_vulnerability、loser_defense

## 影响

- `server/routes/decision.js` 新增 `/devil` 路由
- `server/prompts/decisionModel.js` 新增 `DECISION_DEVIL_PROMPT`
- 前端新增 `DevilReview.vue` 组件，作为 PathDetail 区域的第三个 tab
