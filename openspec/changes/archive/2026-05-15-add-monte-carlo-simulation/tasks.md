## 1. 仿真器核心

- [x] 1.1 创建 `src/utils/simulator.js`，实现 7 种分布抽样函数（normal 用 Box-Muller）
- [x] 1.2 实现 `runMonteCarlo(simSpec, numSamples)` 主函数：抽样 → 归一化 → 加权效用 → 聚合统计
- [x] 1.3 实现分布参数校验（validate sim_spec 的 type 和 params 范围）

## 2. LLM prompt 升级

- [x] 2.1 修改 `DECISION_MODEL_DEEP_PROMPT`，要求 LLM 为每个变量输出 `sim_spec`（分布类型+参数）
- [x] 2.2 修改 `DECISION_REFINE_PROMPT`，同样要求输出分布参数

## 3. 前端集成

- [x] 3.1 在 `useDecisionModel.js` 中新增 `runMonteCarlo()` 方法，调用仿真器并更新 state
- [x] 3.2 修改"深度模拟"按钮逻辑，调用蒙特卡洛而非仅调用 refine API
- [x] 3.3 在 PathDetail.vue 中新增仿真结果展示区域（P10/P50/P90 + σ）

## 4. Counterfactual 修复

- [x] 4.1 修改 counterfactual 场景生成逻辑，从 `state.model.variables` 动态生成参数值
- [x] 4.2 移除硬编码的变量名（'收入预期'、'成长空间'）
