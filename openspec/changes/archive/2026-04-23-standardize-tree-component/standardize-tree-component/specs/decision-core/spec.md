# decision-core 规范增量

## 新增需求

### 决策树组件通用契约

- 系统 SHALL 定义 `treeData` 节点标准契约，包含以下字段：
  - `id`（string|number）：节点唯一标识，用于 `selectedNode` 精准查找
  - `name`（string）：显示文字（不带业务前缀如"第N年："）
  - `step`（number）：层级深度，0 = 根节点
  - `score`（number）：节点分值
  - `status`（string|null）：事件类型（success/warning/error/neutral）
  - `probability`（number）：0-1 累积概率
  - `isDashed`（boolean）：连线是否为虚线

### 数据适配器

- 系统 SHALL 在 `useDecisionModel.js` 中通过 `adaptTree` 函数将 LLM 输出的原始数据标准化为组件契约
- 适配器 SHALL 为每个节点生成唯一 `id`
- 适配器 SHALL 去除 `name` 中"第N年："前缀
- 适配器 SHALL 根据 `step` 自动设置 `isDashed`（step >= 2 为虚线）

## 变更需求

### 决策树可视化

- ~~系统 SHALL 使用 ECharts tree 图表展示决策树~~ → 系统 SHALL 使用 D3.js tree 图表展示决策树
- 组件 SHALL 为纯可视化层，不包含概率计算或业务逻辑
- 组件 SHALL 通过 `id` 匹配 `selectedNode`（替代原有的 `name + year` 匹配）

## 移除需求

- 决策树组件中的概率匹配逻辑（`buildNodeProbMap`、`getNodeProb`）由上游适配器承担
