## 为什么

当前评分公式是纯线性加权 `offset = (paramValue/100 - 0.5) * delta * 2`，参数从 50 调到 80 分数变化严格成正比。但现实决策变量通常是非线性的（收入服从对数正态、成功率服从 Beta 分布、二值事件服从伯努利分布）。

此外，当前 counterfactual 场景使用硬编码变量名（'收入预期'、'成长空间'），在实际用户模型中静默失效。

## 变更内容

引入蒙特卡洛仿真引擎作为"深度模式"，保留现有线性公式作为"快速模式"。用户拖滑块时仍用线性公式实时反馈，点击"深度模拟"时跑蒙特卡洛返回 P10/P50/P90 区间。同时修复 counterfactual 为动态生成。

## 功能 (Capabilities)

### 新增功能

- `monte-carlo-simulation`: 蒙特卡洛仿真引擎，支持 7 种分布（normal/lognormal/triangular/beta/uniform/bernoulli/categorical），返回 P10/P50/P90 + 排名稳定性。同时包含 counterfactual 动态生成功能

### 修改功能

- `decision-core`: 新增仿真结果数据字段到 state.model（p10, p50, p90, sigma, utility_mean 等）

## 影响

- `src/utils/simulator.ts` 新增仿真器模块（7 种分布抽样 + 聚合统计）
- `src/composables/useDecisionModel.js` 新增 `runMonteCarlo()` 方法
- `server/prompts/decisionModel.js` 新增分布参数输出格式（LLM 需为变量输出分布类型+参数）
- 前端新增展示组件（P10/P50/P90 区间展示）
