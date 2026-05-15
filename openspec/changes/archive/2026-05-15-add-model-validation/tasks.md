## 1. 服务端校验层

- [x] 1.1 在 `server/routes/decision.js` 中新增 `validateModel(raw)` 函数，实现结构完整性校验（options≥2、非对象输入等）
- [x] 1.2 在 `validateModel` 中实现范围校验（weights∈[0,1]、scores∈[0,100]、path probability∈[0,1]）
- [x] 1.3 在 `validateModel` 中实现语义一致性校验（trade_offs.dimension ∈ variables、impact key ∈ variables、weights sum≈1、path prob sum≈1）
- [x] 1.4 修改 `/model` 路由：LLM 返回后先调 `validateModel`，error 时返回 400，warning 时继续 `sanitizeModel` 并附加 warnings
- [x] 1.5 修改 `/simulate` 路由：同 1.4 的校验流程
- [x] 1.6 修改 `/refine` 路由：同 1.4 的校验流程

## 2. 前端校验层

- [x] 2.1 在 `src/composables/useDecisionModel.js` 中新增 `validateModel(raw)` 函数，复用与服务端相同的校验规则
- [x] 2.2 修改 `buildModel()` 和 `runSimulation()` 的 API 响应处理：捕获 400 时展示 `errors`，200 含 `warnings` 时展示警告
- [x] 2.3 测试 mock 模式下 validateModel 对非法输入的拒绝行为
