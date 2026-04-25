## 1. 差异化权重计算

- [x] 1.1 在 `useDecisionModel.js` 中重构 `scores` computed：将全局偏移公式改为差异化敏感度公式 `base + Σ((paramValue/100 - 0.5) × delta × 2)`，其中 delta 从 treeData 子节点的 `logic_payload.trade_offs` 中提取
- [x] 1.2 实现 trade_offs 到 sensitivity 的映射函数：按方案名匹配 treeData.children 节点，提取各维度的 delta 值
- [x] 1.3 验证中性位置（所有滑块=50）时 adjusted score 等于 baseScore
- [x] 1.4 验证极端偏好（某维度=100）时排序可能发生变化

## 2. 方案概览双分显示

- [x] 2.1 在 `PathDetail.vue` 的 `options` computed 中，为每个方案附加 `baseScore`（来自 `state.model.scores[optionName]`）
- [x] 2.2 修改概览卡片模板：主分显示 adjusted score（大号），副分显示 baseScore（小号灰色，标注"基准"）
- [x] 2.3 添加差异指示标签：|计算分 - 基准分| > 5 时显示绿色↑或黄色↓

## 3. 推荐结论双分显示

- [x] 3.1 在 `Recommendation.vue` 中接入 `scores` computed（已存在），将其作为基准分展示
- [x] 3.2 修改推荐卡片模板：主分使用 adjusted score，副分使用基准分
- [x] 3.3 添加差异指示标签和简要归因文本

## 4. 分数差异归因

- [x] 4.1 在 `useDecisionModel.js` 中新增 `getScoreAttribution(optionName)` 函数，基于 trade_offs 和当前权重生成归因文本
- [x] 4.2 在推荐结论和方案概览中，当 |差值| > 5 时调用 attribution 函数并展示

## 5. 反事实场景适配

- [x] 5.1 验证 `applyCounterfactual` 和 `resetCounterfactual` 在差异化公式下仍正常工作
- [x] 5.2 验证 counterfactual diff 对比功能显示正确的分数变化
