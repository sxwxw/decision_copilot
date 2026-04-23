## 上下文

当前 DecisionTree.vue 使用 ECharts tree series 渲染决策树。ECharts 的配置驱动模式无法自定义节点 DOM 结构，导致：
- 节点仅为文字标签，无法展示 eventType 颜色标识、概率值、分数等多维信息
- 路径高亮只能通过重新 buildOption 整体刷新，性能开销大
- 连线样式无法与概率值动态关联

决策树是用户理解"决策推演"的核心组件，当前视觉表现力不足以支撑"决策仪表盘"的定位。

## 目标 / 非目标

**目标：**
- 使用 D3.js 替换 ECharts，实现完全可控的 SVG 决策树渲染
- 节点升级为胶囊卡片（160×48px），包含名称、分数、eventType 标识、置信度环
- 连线样式映射概率值（粗细/虚线/中点标注/箭头）
- 点击节点实现路径追溯（ancestors 整条路径高亮 + 呼吸灯）
- d3.zoom 缩放拖拽
- 保持现有组件接口不变（props/emit），上层无感知

**非目标：**
- 节点手动拖拽重排（决策树逻辑顺序不应被破坏）
- 垂直布局切换（保持水平，契合时间轴语义）
- 移除 echarts 依赖包（仅 DecisionTree 切换，其他可能用到）
- 修改数据结构或 API 接口

## 决策

### 1. D3.js vs 其他 SVG 库

**选择 D3.js**：
- d3.hierarchy + d3.tree 提供成熟的层次布局算法，nodeSize 精确控制间距
- d3.linkHorizontal 自动计算贝塞尔曲线控制点
- d3.zoom 内置缩放拖拽，体验优于 ECharts 的 roam
- SVG 渲染（非 Canvas），每个节点是真实 DOM，CSS 动画直接可用

**未选 ECharts**：配置对象模式无法自定义节点 DOM，已达视觉天花板。
**未选 Cytoscape.js**：侧重图网络而非树形结构，tree layout 不如 D3 自然。

### 2. SVG 渲染 vs Canvas 渲染

**选择 SVG**：
- 每个节点是 `<g>` 元素，支持 CSS class、hover、transition、keyframes
- 路径追溯通过 `.classed('active', true)` 精确控制，无需整体重绘
- 置信度环 CSS `stroke-dasharray` 动画直接可用

Canvas 虽性能好，但决策树节点数有限（mock 数据约 19 个节点），SVG 完全够用。

### 3. 布局算法：d3.tree 自动布局

```
d3.tree()
  .nodeSize([60, 240])  // 纵向 60px（卡片 48 + 间隙 12），横向 240px（卡片 160 + 连线 80）
  .separation(() => 1)  // 兄弟节点间距系数
```

水平布局：交换 d3.tree 输出的 x/y 坐标（x 控制垂直位置，y 控制水平层级）。

### 4. 节点数据结构

从 treeData JSON 到 D3 层次结构：
```
treeData → d3.hierarchy() → d3.tree().nodeSize() → 每个 node 获得 .x/.y 坐标
```

节点附加数据（eventType、probability、score）从原始 treeData 节点继承。

### 5. 路径追溯实现

```js
function tracePath(clickedNode) {
  const ancestors = clickedNode.ancestors()  // d3 内置方法
  const ancestorIds = new Set(ancestors.map(n => n.id || n.data.name))
  
  // 所有节点
  nodes.classed('in-path', n => ancestorIds.has(n.id || n.data.name))
    .classed('out-of-path', n => !ancestorIds.has(n.id || n.data.name))
  
  // 所有连线
  links.classed('in-path', d => ancestorIds.has(d.target.id || d.target.data.name))
}
```

### 6. 置信度环实现

```
外层: <circle r="14" stroke="#e5e4e7" fill="none" stroke-width="3"/>
内层: <circle r="14" stroke="#6366f1" fill="none" stroke-width="3"
              stroke-dasharray="C" stroke-dashoffset="C*(1-p)"/>
C = 2πr ≈ 87.96
```

置信度 p 来自节点的 probability 字段（从根到该节点的概率累积）。

### 7. 连线中点标注

```js
const pathEl = pathNode.node()
const len = pathEl.getTotalLength()
const mid = pathEl.getPointAtLength(len / 2)
// 在 (mid.x, mid.y) 处放置 <text> 标注
```

精确贴合贝塞尔曲线中轴线，避免文字偏离。

## 风险 / 权衡

| 风险 | 缓解措施 |
|------|---------|
| D3.js 增加包体积 (~90KB gzipped) | 仅 DecisionTree 使用，可考虑按需引入 d3-hierarchy + d3-shape + d3-zoom 子包 |
| 首次实现 D3 布局可能有调试成本 | mock 数据固定结构，可先在 HTML 原型中调通 |
| SVG 节点过多时性能下降 | 当前节点数 < 30，SVG 无压力 |
| 从 ECharts 迁移后，旧 roam 交互习惯改变 | d3.zoom 提供相同能力，用户感知差异小 |
