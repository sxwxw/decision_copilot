## 上下文

当前项目中，用户拖动左侧参数滑块时，只有 PathDetail.vue 更新分数和概率。DecisionTree.vue 和 ForkComparison.vue 使用静态数据，不响应参数变化，造成认知断层。

核心数据流：`ParamSlider → DecisionView.recalcScores() → recalcProbabilities() → state.adjustedProbabilities`。问题是 `state.adjustedProbabilities` 没有传递给 DecisionTree，ForkComparison 也没有任何敏感度计算。

## 目标 / 非目标

**目标：**
- 决策树连线标签 `P=XX%` 在参数调整时实时更新为调整后的概率
- ForkComparison 面板展示导致分支分歧的关键变量
- 改动最小化，复用现有 D3 全量重绘管线

**非目标：**
- 不做 D3 增量更新或 transition 动画
- 不做节点呼吸边框高亮
- 不修改 LLM 建模逻辑或 API

## 决策

### 1. 概率同步：`_version` 计数器触发重绘

**决策：** 在 `useDecisionModel.js` 的 `recalcScores()` 中，给 `state.model.treeData` 附加一个递增的 `_version` 字段，触发现有的 `watch(() => props.treeData, { deep: true })` 全量重绘。

**替代方案：**
- 新增 `adjustedProbMap` prop + 独立 watch → 需要修改 DecisionTree 的渲染逻辑，增加复杂度
- 直接修改节点的 `probability` 字段 → 会污染原始数据，反事实重置时需要恢复

**选择 `_version` 的原因：** 改动最小（一行代码），不污染原始 probability 字段，全量重绘在数据规模下无性能问题。

### 2. 概率值传递：新 prop `adjustedProbMap`

**决策：** DecisionTree.vue 新增 `adjustedProbMap: Object` prop。在 renderTree 的连线标签生成和节点显示中，优先从 `adjustedProbMap` 按 pathId 查找值，找不到则 fallback 到 `d.target.data.probability`。

但这里有个关键问题：D3 的 `adaptTree` 生成的节点 **没有 pathId 字段**，而 `adjustedProbabilities` 的 key 是 pathId（如 `path-1`）。需要建立 **节点 → pathId 的映射**。

**映射方案：** 在 `adaptTree()` 中，为每个节点注入 `pathIds` 数组（一个节点可能属于多条 path）。渲染时从节点的 `pathIds` 中查找 `adjustedProbMap` 中的值。

**替代方案：** 用路径名称匹配（如 `path.name.includes(nodeName)`）→ 不精确，可能匹配到多个

### 3. 敏感度标识：前端 computed 计算

**决策：** ForkComparison.vue 内部新增 computed `divergenceKey`，计算当前节点子分支的 `trade_offs` 差异：
1. 收集所有子分支的 trade_offs，合并所有维度
2. 对每个维度计算极差（max - min delta）
3. 取极差最大的维度作为关键分歧变量
4. 展示为标签：`关键分歧：财务回报（极差 75）`

不需要新的状态管理，数据来自 `branches[].logic_payload.trade_offs` 或 `node.logic_payload.trade_offs`。

## 风险 / 权衡

**[风险] D3 全量重绘导致视觉闪烁**
→ 缓解：在 svg 上保留 zoom transform 状态（`zoomG` 变量已存在），重绘后恢复。数据量很小，重绘时间 <10ms

**[风险] `adaptTree` 修改可能影响其他依赖 treeData 的组件**
→ 缓解：只新增 `pathIds` 字段，不修改现有字段结构。DecisionTree、ForkComparison 都以现有字段为主

**[风险] ForkComparison 使用的 trade_offs 数据来源不统一**
→ 观察：当前代码中 ForkComparison 的 trade_offs 先从 `child.logic_payload` 取，取不到则 fallback 到 `node.logic_payload`。这意味着某些子节点可能没有自己的 trade_offs。敏感度计算需要处理这种情况
