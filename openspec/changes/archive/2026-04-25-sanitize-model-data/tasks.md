# 任务：LLM 数据清洗器

## 1. 新增 `sanitizeModel` 函数
- [x] 1.1 在 `src/composables/useDecisionModel.js` 中新增 `sanitizeModel(rawData)` 独立函数
  - 结构格式化：强制数组/对象类型，补全缺失字段
  - trade_offs.dimension 归一化到 variables.name
  - paths.impact.key 归一化到 variables.name
  - scores/weights key 归一化

## 2. 实现 `_pathRef` 语义索引
- [x] 2.1 在 `sanitizeModel` 中新增 `buildPathRefs(treeData, paths)` 子函数
  - 精确匹配事件名
  - 双向包含匹配
  - 位置回退 + console.warn
  - 将 pathId 注入到匹配到的树节点 `_pathRef` 数组

## 3. 简化 `adaptTree`
- [x] 3.1 移除 `eventProbMap` 构建逻辑（由 sanitizeModel 的 pathRef 替代概率计算前置）
- [x] 3.2 移除 `matchPath` 逻辑
- [x] 3.3 直接复制 `_pathRef` → `node.pathIds`

## 4. 更新 `DecisionTree.vue`
- [x] 4.1 `resolveAdjustedProb` 改用 `_pathRef` 字段（而非 `pathIds`）

## 5. 更新调用链
- [x] 5.1 `buildModel` 中：`sanitizeModel` → `adaptTree`
- [x] 5.2 `runSimulation` 中：`sanitizeModel` → `adaptTree`
