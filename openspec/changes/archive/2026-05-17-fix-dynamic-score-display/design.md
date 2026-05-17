## 上下文

当前决策系统存在两个不一致问题：
1. 调参后方案概览分数正确变化，但 ForkComparison 和 PathDetail chain-card 仍显示静态基准分
2. `recalcProbabilities` 的概率重算公式使用 `50 + impactVal` 导致 alignment 语义错误，调参后概率变化仅 ~1%

## 目标 / 非目标

**目标：**
- ForkComparison 卡片分值使用调参后动态分数
- PathDetail 路径溯源步骤卡片分值使用调参后动态分数
- 移除错误的概率重算逻辑，概率直接使用 LLM 基准值

**非目标：**
- 不引入后端 API 变化
- 不改变评分计算公式本身
- 不修改 LLM prompt 或返回数据结构

## 决策

### 1. ForkComparison 分值：改为接收 `getAdjustedScore` prop

ForkComparison 当前接收 `adjustedProbMap` 和 `node.children`。新增 `getAdjustedScore` 函数 prop，在模板中用它计算 `child.score` 的调参后值。

- 备选方案：在 composable 层预处理数据传入。但这样会破坏现有的 props 契约，且 ForkComparison 已经有接收函数的先例（虽然当前未用）。选择传函数更灵活。

### 2. PathDetail chain-card 分值：内部 computed 计算

PathDetail 已经接收了 `getAdjustedScore` prop，chain-card 模板（PathDetail 内部渲染 pathChain 的每个 step）可以直接使用该函数计算动态分数，无需新增 prop。

### 3. recalcProbabilities 简化：仅保留初始化赋值，移除 alignment/scale 逻辑

`recalcProbabilities` 原本在每次调参时重新计算路径概率。改为仅从 LLM 返回的 `paths[].probability` 初始化 `state.adjustedProbabilities`（建模时调用一次即可）。调参时不再调用概率重算。

- 备选方案：修 alignment 公式但保留重算。但由于概率变化需要后端 LLM 重新评估事件可能性，前端纯公式无法正确模拟，因此直接去掉重算更干净。

### 4. `recalcScores` 仅调 `recalcProbabilities` 的地方不再调用

`recalcScores` 中调用了 `recalcProbabilities()`，改为移除该调用，只保留 `_version` bump 触发 tree 重新渲染。

### 5. 未来概率联动的归属

如果将来需要调参影响概率，`recalcProbabilities` 应在 `src/engines/` 中作为独立引擎实现（如 `engines/probEngine.js`），属于领域计算层职责，不应放在 composable 编排层。当前仅删除错误公式，不预留此文件。

## 风险 / 权衡

- **移除概率重算后，调参时概率不再变化**：这是有意为之。概率是 LLM 评估的客观事件发生可能，不应随用户偏好变化。如果未来需要概率联动，应在后端重新调用 LLM 评估。
- **ForkComparison 中 `getAdjustedScore` 依赖 `state.model.options`**：如果选项名不匹配会返回 fallback 值 50，这是已有行为，不会恶化。
- **`recalcProbabilities` 属于引擎层职责但当前放在 composable 中**：这是历史遗留。本变更直接删除错误公式而非迁移，因为公式语义本身就不成立。未来如需概率联动，应在 `engines/` 中实现。
