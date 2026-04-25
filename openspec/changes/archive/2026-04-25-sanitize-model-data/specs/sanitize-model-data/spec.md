# 规范：LLM 数据清洗器

## 需求：结构格式化

### 场景：修正数组类型缺失

**Given** LLM 返回的原始数据  
**When** `sanitizeModel` 被调用  
**Then** 以下字段必须被强制为正确类型：

| 字段 | 期望类型 | 错误时处理 |
|------|---------|-----------|
| `options` | `string[]` | 空数组 |
| `variables` | `object[]` | 补全最小集合 |
| `weights` | `object` | 空对象 |
| `treeData` | `object` | 默认根节点 |
| `paths` | `object[]` | 空数组 |
| `scores` | `object` | 空对象 |
| `recommendation` | `object` | 默认空结构 |

### 场景：`trade_offs.dimension` 归一化

**Given** LLM 返回的 `trade_offs` 中包含不在 `variables.name` 中的 dimension  
**When** 执行清洗  
**Then** 非法 dimension 被移除，保留合法项

### 场景：`paths.impact.key` 归一化

**Given** `paths[].timeline[].impact` 包含不在 `variables.name` 中的 key  
**When** 执行清洗  
**Then** 非法 key 被移除

### 场景：`scores` / `weights` key 归一化

**Given** `scores` 或 `weights` 的 key 不在 `options` 或 `variables.name` 中  
**When** 执行清洗  
**Then** 非法 key 被移除，缺失的必要 key 补全默认值

## 需求：语义索引

### 场景：`_pathRef` 注入到树节点

**Given** `treeData` 包含完整的层级结构，`paths` 包含 timeline 数组  
**When** 执行语义索引  
**Then** 每个树节点（option / L1 outcome / L2 consequence）获得 `_pathRef` 数组

### 场景：精确匹配事件名

**Given** `path.timeline[i].event` 与某个树节点名完全相等  
**When** 执行索引  
**Then** 该节点的 `_pathRef` 包含此 path id

### 场景：双向包含匹配

**Given** 事件名与树节点名不相等，但一方包含另一方  
**When** 执行索引  
**Then** 该节点的 `_pathRef` 包含此 path id

### 场景：位置回退

**Given** 某个事件名无法通过精确或包含匹配到任何树节点  
**When** 执行索引  
**Then** 按 path segment 的 index 强行匹配同级子节点的第 N 个，并打印 `console.warn`

### 场景：`paths` 中无事件时的回退

**Given** 某条 path 没有 `timeline` 或为空  
**When** 执行索引  
**Then** 从 `path.name` 解析 `→` 分割符获取段名，再进行匹配

## 需求：前端契约

### 场景：`adaptTree` 使用 `_pathRef`

**Given** 清洗后的数据已包含 `_pathRef`  
**When** `adaptTree` 被调用  
**Then** 节点直接复制 `_pathRef`，不再执行 `matchPath` 逻辑

### 场景：`DecisionTree` 使用 `_pathRef` 查概率

**Given** 节点的 `data._pathRef` 已存在  
**When** 需要显示链路概率标签  
**Then** 遍历 `_pathRef` 从 `adjustedProbMap` 中取值，不再遍历 `pathIds`
