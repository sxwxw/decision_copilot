## 为什么

当前 `recalcProbabilities()` 中的对齐缩放公式 `scale = 0.7 + avgAlignment * 0.6` 会导致调整后路径概率总和 ≠ 1.0，破坏概率语义。

具体问题：
1. 不归一化：两条原本 sum = 1.0 的路径，调整后可能变成 0.85 + 1.15 = 2.0
2. 量纲不匹配：`impact` 是 delta（可为负），`userVal` 是 0~100 偏好，直接比较产生的 alignment 无意义
3. `getScoreAttribution()` 硬编码中文字符串，假设特定 4 路逻辑分支

## 变更内容

修复概率调整的语义正确性，增加归一化步骤，修复量纲问题，将分数归因改为动态组装。

## 功能 (Capabilities)

### 修改功能

- `tree-probability-sync`: 增加归一化步骤，确保调整后的路径概率总和 ≈ 1.0；修复 alignment 公式中 impact 的量纲问题
- `decision-core`: 分数归因从硬编码改为动态组装

## 影响

- `src/composables/useDecisionModel.js` 中的 `recalcProbabilities()` 和 `getScoreAttribution()`
- 决策树连线概率标签展示
