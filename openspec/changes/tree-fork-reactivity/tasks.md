## 1. 基础数据层 — adaptTree 注入 pathIds

- [x] 1.1 在 `adaptTree()` 中为每个节点新增 `pathIds` 数组字段，根据 paths 数据建立节点到 path 的映射
- [x] 1.2 验证 `adaptTree` 输出的 `pathIds` 正确覆盖所有节点层级（根节点包含所有 pathId，方案节点包含对应选项下的 pathId）

## 2. 概率同步 — DecisionTree 展示调整后概率

- [x] 2.1 在 `useDecisionModel.js` 的 `recalcScores()` 中新增 `treeData._version` 递增计数器，触发现有 watch 重绘
- [x] 2.2 DecisionTree.vue 新增 `adjustedProbMap` prop
- [x] 2.3 DecisionView.vue 传递 `state.adjustedProbabilities` 给 DecisionTree 的 `adjustedProbMap`
- [x] 2.4 修改 `renderTree()` 连线标签逻辑，优先从 `adjustedProbMap` + 节点 `pathIds` 查找值，fallback 到原始 probability
- [x] 2.5 确保重绘后保留 D3 zoom transform 状态，避免视觉闪烁

## 3. 敏感度标识 — ForkComparison 展示关键分歧变量

- [x] 3.1 ForkComparison.vue 新增 computed `divergenceKey`，计算子分支 trade_offs 各维度的极差，取最大值作为关键分歧变量
- [x] 3.2 ForkComparison.vue 在卡片区域上方展示敏感度标签，格式：`关键分歧：{维度}（极差 {值}）`
- [x] 3.3 处理 trade_offs 数据来源不统一的情况（子节点无则 fallback 到父节点）
- [x] 3.4 处理无 trade_offs 数据的空状态
