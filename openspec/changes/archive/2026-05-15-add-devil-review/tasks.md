# 1. 服务端 DEVIL Agent

- [x] 1.1 在 `server/prompts/decisionModel.js` 中新增 `DECISION_DEVIL_PROMPT`
- [x] 1.2 在 `server/routes/decision.js` 中新增 POST `/devil` 路由
- [x] 1.3 DEVIL 返回结构化 JSON：challenges + bias_flags + winner_vulnerability + loser_defense

## 2. 前端审查面板

- [x] 2.1 在 `src/components/decision/` 下新增 `DevilReview.vue` 组件
- [x] 2.2 在 PathDetail 区域底部新增第三个 tab "[审查]"
- [x] 2.3 按 severity 排序展示 challenges，支持展开/收起
- [x] 2.4 展示 bias_flags 和 winner_vulnerability 区域

## 3. 触发机制

- [x] 3.1 在 `runDeepSimulation()` 完成后自动调用 `/devil` 路由
- [x] 3.2 新增"重新审查"按钮，支持手动触发
