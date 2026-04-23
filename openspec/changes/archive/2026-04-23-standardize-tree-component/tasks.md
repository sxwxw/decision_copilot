# 任务清单

## 已完成

- [x] T1: 在 `useDecisionModel.js` 中新增 `adaptTree` 适配器函数
- [x] T2: 在 `buildModel` 和 `runSimulation` 中调用 `adaptTree` 标准化 treeData
- [x] T3: 重构 `DecisionTree.vue` — 删除所有概率计算/路径匹配逻辑
- [x] T4: 重构 `DecisionTree.vue` — 改用标准化字段（`id`/`step`/`probability`/`isDashed`）
- [x] T5: 重构 `DecisionTree.vue` — `selectedNode` 查找改用 `id` 匹配
- [x] T6: 更新 `DecisionView.vue` — 移除 `:paths` prop 传递
- [x] T7: 更新 `DecisionView.vue` — 简化 `findMatchingPath` 逻辑
