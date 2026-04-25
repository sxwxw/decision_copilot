# 任务：trade_offs 加权推导

## 1. 新增 `deriveTradeoffs` 函数
- [x] 1.1 在 `src/composables/useDecisionModel.js` 中新增 `deriveTradeoffs(treeData, paths, weights)` 函数
  - 遍历每个 option 的 trade_offs，找出有权重但缺失的维度
  - 对该选项的每个 L1 子节点，用 `path.name` 匹配对应 path 获取 probability
  - 加权平均：`delta = Σ(delta_child × path_probability) / Σ(path_probability_for_child)`
  - 注入推导结果到 option 级 trade_offs
  - 如果所有子节点都没有该维度，注入 `{dimension, delta: 0}`

## 2. 集成到清洗流程
- [x] 2.1 在 `sanitizeModel` 中调用 `deriveTradeoffs`（在 trade_offs 过滤后、语义索引前）

## 3. 更新 Prompt
- [x] 3.1 `DECISION_MODEL_PROMPT` 和 `DECISION_MODEL_DEEP_PROMPT` 中增加约束：所有出现在 weights 中的维度必须在至少一个选项的 trade_offs 中出现

## 4. 验证
- [ ] 4.1 确认缺失维度（如"短期收益"）在清洗后出现在选项级 trade_offs 中，且拖动滑块时分数有变化
