## 1. Prompt 层修改

- [x] 1.1 修改 `DECISION_MODEL_PROMPT`：新增 delta 范围约束（±20）、跨选项差值约束（≤30）、risk_adjustment 字段说明
- [x] 1.2 修改 `DECISION_MODEL_DEEP_PROMPT`：同步 delta 约束和 risk_adjustment 说明
- [x] 1.3 修改 `DECISION_REFINE_PROMPT`：同步 delta 约束
- [x] 1.4 修改 `DECISION_DEVIL_PROMPT`：新增 select 类型变量不参与权重的规则，消除假阳性
- [x] 1.5 修改 `DECISION_DEVIL_MODEL_PROMPT`：补充 delta 范围合理性审查指引

## 2. 后端校验

- [x] 2.1 在 `validateModel()` 中新增 delta 范围校验：绝对值 > 20 标记 warning，> 40 标记 error
- [x] 2.2 在 `validateModel()` 中新增跨选项 delta 差值校验：> 30 标记 warning
- [x] 2.3 在 `sanitizeModel()` 中补全 `risk_adjustment` 默认值

## 3. 前端评分公式更新

- [x] 3.1 修改 `useDecisionModel.js` 中 `scores` computed 的 offset 公式，将权重作为乘数
- [x] 3.2 修改 `useDecisionModel.js` 中敏感性分析公式，同步权重乘数逻辑

## 4. 蒙特卡洛仿真更新

- [x] 4.1 修改 `simulator.js` 中效用计算 offset 公式，将权重作为乘数
- [x] 4.2 修改 `simulator.js`，根据 risk_adjustment 和当前风险偏好类型调整效用值

## 5. Mock 数据更新

- [x] 5.1 更新 `server/mock/decisionModel.json`，添加 risk_adjustment 字段以对齐新结构

## 6. 回归修复

- [x] 6.1 修复缺失的 `setRiskPreference` 函数，添加仿真联动逻辑
- [x] 6.2 修复 `resetModel` 未重置 `riskPreference` 的遗漏
- [x] 6.3 修复 `buildModel` 调用处 `state.riskPreference` 未同步的遗漏
