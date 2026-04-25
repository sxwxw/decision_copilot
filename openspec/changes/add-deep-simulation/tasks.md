# 任务：深度模拟

## 1. 新增 `DECISION_REFINE_PROMPT`

- [x] 1.1 在 `server/prompts/decisionModel.js` 中新增深度模拟专用 prompt
  - 约束 options 与传入一致
  - 约束 variables 维度不变
  - 约束 trade_offs.dimension 必须是变量名
  - 要求返回完整 model 结构
  - 要求 recommendation 包含 delta_analysis 字段

## 2. 新增 `/refine` 路由

- [x] 2.1 在 `server/routes/decision.js` 新增 `POST /api/decision/refine`
  - 接收 `{ currentModel, paramValues }`
  - 调用 LLM（开启思考模式）
  - 返回 sanitizeModel 后的完整 model

## 3. 前端 API 层

- [x] 3.1 在 `src/api/decision.js` 新增 `refineModel(currentModel, paramValues)`

## 4. 重构 `runSimulation`

- [x] 4.1 修改 `src/composables/useDecisionModel.js` 的 `runSimulation`
  - 调用 `refineModel(state.model, state.paramValues)` 替代 `simulateModel`
  - 收到新树后调用 `adaptTree`
  - 记录 `state.snapshotWeights = { ...state.paramValues }`
  - **不重置**滑块为默认值

## 5. 修改 `recalcScores` 公式

- [x] 5.1 `recalcScores` 在有 snapshotWeights 时计算增量偏移
  - shift = (currentValue - snapshotValue) / 100 × delta × 2
  - baseScore 使用新树的 scores

## 6. ParamPanel 深度模拟按钮视觉

- [x] 6.1 参数偏离 50 时，按钮从 plain → primary
- [x] 6.2 单项偏离 > 40 时，按钮右上角显示红点 + 灰色提示文字

## 7. PathDetail 展示 delta_analysis

- [x] 7.1 在方案概览区域，如果有 `recommendation.delta_analysis`，用 el-alert 展示在顶部
