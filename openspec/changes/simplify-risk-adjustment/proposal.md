## 为什么

在 `correct-modeling-prompts` 变更中引入的 `risk_adjustment` 字段包含 `offset` 和 `probability_factor` 两个子字段。实际实现时发现 `probability_factor` 语义不清晰——设计文档说它应该作用于路径概率，但实现却把它和 `offset` 相乘混用在效用计算中，违背了设计意图。且 `recalcProbabilities` 已有基于参数对齐度的概率调节机制，引入 `probability_factor` 会产生双重调节。

简化为仅保留 `offset`，消除语义混乱，减少不必要的复杂度。

## 变更内容

### 移除 `probability_factor` 字段

从 `risk_adjustment` 中移除 `probability_factor`，仅保留 `offset`。`offset` 直接加到效用/基准分上，简单明确。

## 功能 (Capabilities)

### 修改功能

- `risk-preference-adjustment`: 简化 `risk_adjustment` 结构，移除 `probability_factor`，仅保留 `offset`

## 影响

- `server/prompts/decisionModel.js`: 从 3 个 prompt 的 JSON 模板中移除 `probability_factor`
- `src/utils/simulator.js`: 移除 `probability_factor` 的乘算逻辑，仅使用 `offset`
- `src/composables/useDecisionModel.js`: `runMCFromModel` 不再传递 `probability_factor`
- `server/mock/decisionModel.json`: 移除 mock 数据中的 `probability_factor`
- `openspec/changes/correct-modeling-prompts/design.md`: 更新设计文档

## 非目标

- 不修改 `recalcProbabilities` 的概率调节逻辑（已有独立机制）
- 不改变 `offset` 的计算方式
- 不影响权重乘数公式
