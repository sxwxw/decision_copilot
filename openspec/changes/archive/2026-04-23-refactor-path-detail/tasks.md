## 1. 数据层 — 路径链构建逻辑

- [x] 1.1 在 `useDecisionModel.js` 中新增 `buildPathChain(nodeId)` 函数，从 treeData 按 id 精准定位节点并收集 ancestors 形成路径链数组
- [x] 1.2 在 `selectNode()` 中调用 `buildPathChain`，将路径链挂载到 `state.selectedNode.pathChain`
- [x] 1.3 移除 `findMatchingPath` 的字符串模糊匹配逻辑（`path.name.includes`），改为通过 pathChain 末节点匹配对应 path

## 2. PathDetail.vue — 模板与样式重构

- [x] 2.1 移除 metrics-col 2x2 指标网格的模板和样式代码
- [x] 2.2 新增 `pathChain` prop（数组类型），移除旧 `path` prop
- [x] 2.3 实现路径链可视化：从根到当前节点的节点卡片序列，展示 name/value/status/probability
- [x] 2.4 timeline 区域扩展为全宽布局，基于 pathChain 末节点匹配对应 path.timeline
- [x] 2.5 更新空状态提示文案为「点击决策树节点查看路径溯源」

## 3. DecisionView.vue — 连线更新

- [x] 3.1 更新 `PathDetail` 的 props 传递：用 `pathChain` 替代 `matchedPath`
- [x] 3.2 简化 `onNodeClick`，移除 `findMatchingPath` 调用（逻辑迁移到 composable）
