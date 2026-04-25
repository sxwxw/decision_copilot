# 提案：路径溯源深度增强

## 问题

当前路径溯源（PathDetail.vue 的 trace 模式）只展示简单的节点名链和一段 explanation 文案，信息量不足。用户点击叶子节点后，无法直观理解"这条路径为什么值这个分"，也无法看到参数变化对路径级指标的影响。

## 解决方案

将路径溯源升级为"活"的监测面板：

1. **综合评分**：展示叶子节点的实时偏移分数（基于当前参数），而非原始 value
2. **路径链中间标注**：在节点之间的箭头上展示 `key_impact` + delta 趋势箭头
3. **实时风险评估**：对比 4 维度 `threshold` vs 当前 `paramValues`，用"最大缺口"策略定位首要风险
4. **路径级归因**：细化到路径节点的 trade_off，找出拉动分数最关键的一环
5. **机会成本**：直接展示叶子节点的 `opportunity_cost`

### 数据策略

在 `selectNode` 后，通过 `enrichPathChain` 辅助函数将 `matchedPath.timeline` 的 impact/threshold/probability 注入到 `pathChain` 节点中，不修改 `adaptTree` 的纯洁性。

### 视觉反馈

当某个维度不达标时，节点加 2px 红色底边。用户拖动滑块时，可以观察到节点"逐个从红变常态"的通关效果。
