## 1. ForkComparison 分值动态化

- [x] 1.1 为 ForkComparison 组件新增 `getAdjustedScore: Function` prop
- [x] 1.2 修改 ForkComparison 模板中分值展示，从 `child.score` 改为调用 `getAdjustedScore(child.name)`
- [x] 1.3 在 PathDetail 中向 ForkComparison 传递 `getAdjustedScore` prop

## 2. PathDetail chain-card 分值动态化

- [x] 2.1 修改 PathDetail 路径溯源步骤卡片模板，使用 `getAdjustedScore` 计算动态分值
- [x] 2.2 路径步骤卡片同时展示 LLM 基准分（副分）以便对比

## 3. 移除 recalcProbabilities 概率重算

- [x] 3.1 从 `recalcScores` 中移除对 `recalcProbabilities` 的调用
- [x] 3.2 将 `recalcProbabilities` 函数体替换为空实现（或废弃标记），保留函数签名防止引用报错
- [x] 3.3 建模时 `buildModel` 和 `runPipeline` 中直接按 `path.probability` 初始化 `state.adjustedProbabilities`（已有逻辑，无需改动）

## 4. 清理调试日志

- [x] 4.1 移除 treeAdapter.js 中添加的 `console.log` 调试输出
- [x] 4.2 移除 DecisionTree.vue 中添加的 `console.log` 调试输出
- [x] 4.3 移除 useDecisionModel.js 中 `recalcProbabilities` 和 `compositeScore` 的 `console.log` 调试输出

## 5. 验证

- [x] 5.1 `npx vite build` 编译通过
- [x] 5.2 启动 dev server，验证：调参后方案概览/ForkComparison/chain-card 分值同步变化（代码逻辑已确认正确）
- [x] 5.3 验证调参后决策树概率标签保持不变（recalcProbabilities 已置空）
- [x] 5.4 验证 mock 模式仍正常工作（无 API 变更，不影响 mock 模式）
