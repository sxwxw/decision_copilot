# 变更：LLM 数据清洗器（结构格式化 + 语义索引）

## 背景

LLM 返回的决策模型数据存在多处结构不匹配和语义断裂问题，导致前端功能失效：

1. **`paths.timeline.event` 与 `treeData` 节点名不匹配** — LLM 在 paths 里用描述性事件名（"产品研发完成"），在树节点用精炼名（"市场突围"），导致 `adaptTree` 的 `matchPath` 永远匹配失败，决策树 P 值不随滑块变化
2. **`trade_offs.dimension` 可能不在 `variables.name` 中** — 方案层遗漏某些变量维度，导致调参时分数不响应
3. **`paths.impact.key`、`weights.key`、`scores.key` 可能与其他集合不一致** — LLM 偶尔拼错或省略关键 key
4. **前端匹配逻辑散落** — `adaptTree` 里混入了正则匹配、字符串清理、路径注入等业务逻辑

## 目标

- 新增 `sanitizeModel` 独立函数，在 `adaptTree` 之前对原始数据进行清洗
- 采用"结构格式化 + 语义索引器"策略
- 为每个树节点注入 `_pathRef` 数组，前端组件直接读取，无需猜测匹配
- 匹配策略：精确匹配 → 双向包含 → 位置回退（不写编辑距离）
- `adaptTree` 只做视图转换（生成 id、坐标布局），保持简洁

## 范围

- 新增 `sanitizeModel` 函数（数据清洗 + `_pathRef` 注入）
- 修改 `adaptTree`：移除 `matchPath` 和 `eventProbMap` 逻辑，直接读取 rawPaths 上已关联的 `_pathRef`
- 修改 `DecisionTree.vue`：`resolveAdjustedProb` 使用 `_pathRef`
- 修改 `useDecisionModel.js` 调用链：`sanitizeModel` → `adaptTree`

## 不做的事

- 不引入编辑距离算法（短文本误差大，语义相反的词距离可能很近）
- 不改 LLM prompt（prompt 只能引导，不能保证）
- 不改前端组件的展示逻辑（分数、概率的渲染方式不变）
