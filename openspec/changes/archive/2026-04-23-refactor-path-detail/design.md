## 上下文

PathDetail.vue 当前采用左右分栏布局：左侧 timeline 展示推演过程，右侧 metrics-col 以 2x2 网格展示收入/成长/风险/幸福指数四个固定指标。该指标网格占用约 35% 的横向空间但信息密度低（仅四个数值），且与用户点击的节点无关联——始终展示整条路径的汇总指标，不反映被点击节点在路径链中的位置和累积影响。

DecisionView.vue 的 `findMatchingPath` 通过 `path.name.includes(nodeName)` 模糊匹配，无法精准定位从根节点到点击节点的完整路径链。

## 目标 / 非目标

**目标：**
- 移除 metrics-col 2x2 指标网格，timeline 占据全部宽度
- 点击节点时，路径详情展示从根节点到该节点的完整路径链（含每个节点的分值、概率、事件类型）
- 重构节点到路径的匹配逻辑，实现精准的路径溯源

**非目标：**
- 不修改 DecisionTree.vue 的画图逻辑或节点渲染
- 不改变 paths 数据结构和后端模型
- 不修改 Recommendation 组件

## 决策

### 1. 路径溯源的数据源：从 treeData 构建路径链

**方案：遍历 treeData 从根到点击节点**

点击节点时，从 `state.model.treeData` 的树结构中查找该节点并收集其所有祖先节点，形成路径链数组。该数组包含每个节点的 `name`、`value`、`step`、`status`（eventType）、`probability` 等字段。

**为什么不从 path.timeline 反推？** timeline 是扁平的事件列表，缺少节点间的层级关系（Root -> Option -> Outcome -> Consequence）。treeData 本身就有 step 分层，更贴合路径溯源的展示需求。

### 2. 节点匹配逻辑：改用 id 精准查找

当前 `findMatchingPath` 用 `path.name.includes(nodeName)` 做字符串模糊匹配，容易误匹配。改为用 `nodeData.id` 在 treeData 中精准定位，同时通过 `ancestors()` 获取完整路径链。

在 DecisionTree.vue 的 `nodeClick` emit 中已传递 `d.data`（含完整 hierarchy 信息），DecisionView.vue 可直接利用。

### 3. PathDetail.vue Props 变更

- 移除 `path` prop（不再依赖外部 path 对象）
- 新增 `pathChain` prop（从根到点击节点的节点数组）
- 保留 `node` prop（当前选中节点）

PathDetail 组件内部从 pathChain 渲染：
- 顶部：到达概率（取末节点 probability）
- 中部：路径链可视化（节点卡片串联，展示 name/value/status）
- 底部：末节点对应 timeline（通过末节点匹配 path.timeline）

### 4. 时间线保留但简化

时间线仍然保留，因为 LLM 返回的 paths[].timeline 包含了详细的 impact 和 threshold 信息，是路径溯源的重要补充。通过路径链末节点的 name 去匹配对应 path 的 timeline。

## 风险 / 权衡

- [风险] treeData 中部分节点可能没有对应 path 的 timeline → 时间线区域显示为空，仅展示路径链
- [风险] 路径链过长导致垂直空间不足 → 路径链采用横向紧凑布局或可折叠设计
