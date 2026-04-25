# spec: sanitize-model-data

## 需求

### 结构格式化

- 系统 SHALL 在 `sanitizeModel` 调用时强制以下字段为正确类型：
  - `options` → `string[]`（错误时空数组）
  - `variables` → `object[]`（错误时补全最小集合）
  - `weights` → `object`（错误时空对象）
  - `treeData` → `object`（错误时默认根节点）
  - `paths` → `object[]`（错误时空数组）
  - `scores` → `object`（错误时空对象）
  - `recommendation` → `object`（错误时默认空结构）

### trade_offs.dimension 归一化

- 系统 SHALL 移除 `trade_offs` 中不在 `variables.name` 中的 dimension

### paths.impact.key 归一化

- 系统 SHALL 移除 `paths[].timeline[].impact` 中不在 `variables.name` 中的 key

### scores / weights key 归一化

- 系统 SHALL 移除 `scores` 或 `weights` 中不在 `options` 或 `variables.name` 中的 key
- 系统 SHALL 对缺失的必要 key 补全默认值

### 语义索引（_pathRef 注入）

- 系统 SHALL 为每个树节点（option / L1 outcome / L2 consequence）生成 `_pathRef` 数组，建立节点到 path 的映射
- 映射规则 SHALL 支持：精确匹配事件名、双向包含匹配、位置回退
- 对于没有 `timeline` 的 path，系统 SHALL 从 `path.name` 解析 `→` 分割符获取段名进行匹配

### 前端契约

- 系统 SHALL 在 `adaptTree` 中直接使用 `_pathRef`，不再执行 `matchPath` 逻辑
- 系统 SHALL 在 `DecisionTree` 中基于 `_pathRef` 从 `adjustedProbMap` 取值展示链路概率标签
