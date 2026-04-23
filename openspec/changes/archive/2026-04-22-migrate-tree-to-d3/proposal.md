## 为什么

当前决策树使用 ECharts tree series 渲染，节点仅为文字标签，eventType 颜色标识、概率值等关键信息只能通过有限的配置对象间接表达。用户无法自定义节点的 DOM 结构，导致视觉层次单薄、信息密度低，与"决策仪表盘"的产品定位不符。

D3.js 提供对 SVG DOM 的完全控制，可以将每个节点渲染为包含置信度环、事件标识、分数的胶囊卡片，并实现概率驱动的连线粗细、路径追溯呼吸灯等高级可视化效果。

## 变更内容

- **替换渲染引擎**：将 DecisionTree.vue 从 ECharts tree 迁移到 D3.js 手写 SVG 渲染
- **新增胶囊卡片节点**：160×48px 胶囊形状，包含节点名、分数、eventType 颜色标识、置信度环
- **新增概率连线**：贝塞尔曲线线宽映射概率值，高风险路径用虚线，中点标注 "P=xx%"，末端箭头
- **新增路径追溯**：点击节点时 node.ancestors() 整条路径高亮为紫色 + CSS 呼吸灯动画，非路径节点 opacity 降至 0.2
- **新增缩放交互**：d3.zoom 实现平滑缩放拖拽，支持语义缩放
- **保留现有接口**：props treeData/selectedNode 和 emit nodeClick 不变，上层组件无需修改

## 功能 (Capabilities)

### 新增功能
- `tree-capsule-node`: 决策树节点渲染为胶囊卡片，包含名称、分数、eventType 标识、置信度环
- `tree-probability-link`: 决策树连线支持概率驱动的粗细映射、虚线样式、中点标注、末端箭头
- `tree-path-tracing`: 点击节点追溯整条路径并高亮，非路径节点淡化
- `tree-zoom-interaction`: D3 zoom 实现的缩放拖拽交互

### 修改功能
- `decision-core`: 决策树可视化需求变更 — 从"ECharts tree 图表"升级为"D3.js 胶囊卡片渲染"，交互方式从"点击高亮"扩展为"路径追溯 + 缩放"

## 影响

- **受影响代码**：`src/components/decision/DecisionTree.vue`（完全重写）
- **受影响依赖**：新增 `d3`，`echarts` 和 `vue-echarts` 可标记为不再使用（后续可移除）
- **不受影响**：所有上层组件（DecisionView、PathDetail 等）、API 层、composables、mock 数据结构