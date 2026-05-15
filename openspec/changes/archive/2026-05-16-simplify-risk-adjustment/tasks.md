## 1. 仿真器移除 probability_factor

- [x] 1.1 修改 `simulator.js` 效用计算：将 `utility += adj.offset * adj.probability_factor` 改为 `utility += adj.offset`
- [x] 1.2 修改 `simulator.js` 中 `riskAdjMap` 构建：移除 `probability_factor` 字段提取
- [x] 1.3 修改 `useDecisionModel.js` 中 `runMCFromModel`：移除 `risk_adjustment` 中 `probability_factor` 的传递（如有）

## 2. Prompt 模板更新

- [x] 2.1 从 `DECISION_MODEL_PROMPT` 的 JSON 模板中移除 `probability_factor`
- [x] 2.2 从 `DECISION_MODEL_DEEP_PROMPT` 的 JSON 模板中移除 `probability_factor`

## 3. Mock 数据更新

- [x] 3.1 从 `server/mock/decisionModel.json` 的所有选项 `risk_adjustment` 中移除 `probability_factor`

## 4. 设计文档更新

- [x] 4.1 更新 `correct-modeling-prompts` 的 design.md：移除 `probability_factor` 相关描述
