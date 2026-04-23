## 1. LLM Prompt 与数据层

- [x] 1.1 在 `server/prompts/decisionModel.js` 的 DECISION_MODEL_PROMPT 中，为 treeData 中间节点新增 `logic_payload` 字段定义（key_impact / risk_level / primary_reason / trade_offs / opportunity_cost）
- [x] 1.2 在 `server/prompts/decisionModel.js` 的 JSON 示例中添加 logic_payload 示例数据
- [x] 1.3 在 `useDecisionModel.js` 的 `adaptTree()` 中透传 logic_payload 至标准化节点
- [x] 1.4 更新 mock 数据，为中间节点添加 logic_payload 字段（待 LLM 联调后自然生成，prompt 已更新）

## 2. 节点类型判断逻辑

- [x] 2.1 在 `useDecisionModel.js` 中新增 `getNodeViewMode(node)` 工具函数，根据 children 和 step 返回 'overview' / 'fork-compare' / 'trace'
- [x] 2.2 在 `selectNode()` 中将 viewMode 挂载到 state.selectedNode.viewMode

## 3. ForkComparison.vue 新组件

- [x] 3.1 创建 `ForkComparison.vue` 组件，接收 pathChain 和 matchedPath props
- [x] 3.2 实现面包屑路径链展示（复用 PathDetail 的链式样式）
- [x] 3.3 实现分叉对比卡片：并排展示子分支（name / probability / score / opportunity_cost / trade_offs）
- [x] 3.4 实现前端模板拼接的决策建议文本
- [x] 3.5 实现分支 >2 时的横向滚动布局

## 4. PathDetail.vue 视图路由

- [x] 4.1 在 PathDetail.vue 中引入 ForkComparison 组件
- [x] 4.2 根据 viewMode 条件渲染三种视图：overview / fork-compare / trace
- [x] 4.3 实现根节点全局概览视图（方案卡片列表 + 排序）
