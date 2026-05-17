## 为什么

当前调参后，方案概览分数正确变化，但 ForkComparison 分叉卡片和 PathDetail 路径溯源卡片中的分值始终是 LLM 基准分，用户无法在详情面板看到调参后的动态反馈。同时 `recalcProbabilities` 的概率重算公式使用了错误的语义（`50 + impactVal` 超出用户输入范围），导致调参后概率变化微乎其微（仅 ~1%），且归一化进一步稀释了变化。

## 变更内容

- **ForkComparison 分值动态化**：分叉卡片中的"分值"从 `child.score`（基准分）改为 `getAdjustedScore(child.name)` 计算出的调参后分数
- **PathDetail chain-card 分值动态化**：路径溯源每个步骤卡片中展示的分值使用调参后动态分数
- **移除 recalcProbabilities 概率重算**：删除基于用户参数对齐度计算 probability 的公式逻辑，决策树和 ForkComparison 直接使用 LLM 给出的基准概率
- **清理调试日志**：移除之前添加的 `console.log` 调试输出

## 功能 (Capabilities)

### 新增功能
<!-- 无新增功能，均为修改现有行为 -->

### 修改功能
- `tree-probability-sync`: 移除前端概率重算逻辑，概率直接取自 LLM 基准值，不再随用户调参变化
- `dynamic-scoring-and-risk-adjustment`: 分值已在方案概览中正确动态化，现扩展至 ForkComparison 和 PathDetail chain-card

## 影响

- `src/components/decision/ForkComparison.vue`: 分值展示改为动态计算
- `src/components/decision/PathDetail.vue`: chain-card 分值展示改为动态计算，可能需要传参或新增计算属性
- `src/composables/useDecisionModel.js`: 删除 `recalcProbabilities` 中的 alignment/scale 逻辑，移除相关 debug log
- `src/engines/treeAdapter.js`: 移除之前添加的 debug log
- `src/components/decision/DecisionTree.vue`: 移除之前添加的 debug log

## 非目标

- 不引入新的后端 API 或 LLM 调用
- 不改变评分计算公式本身
- 不修复路径溯源中 event→node 匹配逻辑（已有独立问题追踪）
