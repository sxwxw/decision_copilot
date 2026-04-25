## 为什么

当前用户拖动左侧参数滑块时，只有底部 PathDetail 组件更新分数和概率。DecisionTree 和 ForkComparison 展示的是静态数据，造成**认知断层**：左侧参数变了，右侧列表排序变了，但中间的决策树纹丝不动。ForkComparison 作为"反事实推演"面板，如果数据是死的，就失去了比较意义。

## 变更内容

**层次一：决策树概率实时同步**
- 用户调参时，决策树连线标签 `P=XX%` 实时反映 `adjustedProbabilities`
- 使用 `_version` 计数器触发 D3 重绘，不做增量更新

**层次三：ForkComparison 敏感度标识**
- 在分叉对比卡片区域上方，标注导致各分支选择分歧的关键变量
- 基于 `trade_offs` 中各维度的 delta 极差计算，前端本地完成

## 功能 (Capabilities)

### 新增功能
- `tree-probability-sync`: 决策树在参数调整时实时更新连线和节点概率显示
- `fork-sensitivity-indicator`: 分叉对比面板展示导致分支分歧的关键变量标识

### 修改功能
<!-- 无现有规范级需求变更 -->

## 影响

- `DecisionTree.vue`: 新增 `adjustedProbMap` prop，连线标签改用调整后的概率值
- `DecisionView.vue`: 传递 `adjustedProbabilities` 给 DecisionTree
- `ForkComparison.vue`: 新增敏感度标识计算和展示
- 不修改 API 或后端逻辑

## 非目标

- 不在层次二中实现节点呼吸边框高亮动画
- 不使用 D3 transition 做数字滚动效果
- 不修改首次建模的 LLM 交互逻辑
