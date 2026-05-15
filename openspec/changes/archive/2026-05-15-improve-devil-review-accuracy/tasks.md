## 1. 扩充 /devil 路由的 prompt 构造

- [x] 1.1 修改 `server/routes/decision.js` `/devil` 路由，从 `currentModel` 中提取变量完整信息（name + sim_spec.type + weight）和选项 trade_offs，构建更完整的 userPrompt

## 2. 更新 DEVIL prompt 约束

- [x] 2.1 修改 `server/prompts/decisionModel.js` 中 `DECISION_DEVIL_PROMPT`，增加"禁止虚构数据缺失"的硬约束指令

## 3. 同步修复流水线 devils 步骤

- [x] 3.1 修改 `executePipelineSteps` 中 `devils` 步骤的 userPrompt 构造，传入与 /devil 路由相同的完整模型信息

## 4. 验证

- [x] 4.1 确认 Mock 模式下返回的 placeholder 数据结构兼容新 prompt
- [x] 4.2 使用用户提供的实际 model 数据测试 /devil 接口，验证审查结果不再出现"变量全为 null"等虚假指控
