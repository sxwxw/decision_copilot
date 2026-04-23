# 任务：从 ECharts 迁移决策树到 D3.js

## 1. 环境准备

- [x] 1.1 安装 d3 依赖：`npm install d3`
- [x] 1.2 确认当前 DecisionTree.vue 的接口（props treeData/selectedNode，emit nodeClick）和现有功能

## 2. D3 决策树骨架

- [x] 2.1 新建 DecisionTree.vue，使用 D3.js 替换 ECharts，创建 SVG 容器 + d3.hierarchy + d3.tree 布局（nodeSize([60, 240])，水平布局）
- [x] 2.2 实现基础节点渲染：每个节点渲染为 SVG `<g>` 元素，位置由 d3.tree 计算
- [x] 2.3 实现基础连线渲染：使用 d3.linkHorizontal() 生成贝塞尔曲线路径

## 3. 胶囊卡片节点

- [x] 3.1 渲染 160×48px 圆角卡片（SVG rect rx=8）
- [x] 3.2 添加节点名称文本（SVG text，居中显示）
- [x] 3.3 添加 eventType 颜色标识（左侧圆点或左边框，positive=#10b981, negative=#ef4444, neutral=#9ca3af）
- [x] 3.4 添加置信度环（双 SVG circle + stroke-dasharray，概率映射填充面积）
- [x] 3.5 添加节点分数显示（卡片右侧或底部）

## 4. 概率连线

- [x] 4.1 连线宽度映射概率值（d3.scaleLinear([0,1], [1,4])）
- [x] 4.2 高风险（negative）节点连线使用虚线（stroke-dasharray）
- [x] 4.3 连线末端添加小三角形箭头（SVG marker）
- [x] 4.4 连线中点标注 "P=xx%"（getPointAtLength 精确计算位置）

## 5. 缩放交互

- [x] 5.1 实现 d3.zoom 缩放拖拽（滚轮缩放 + 拖拽平移）
- [x] 5.2 设置缩放边界（0.3x ~ 3x）
- [x] 5.3 验证禁止节点手动重排

## 6. 路径追溯高亮

- [x] 6.1 实现点击节点事件：调用 node.ancestors() 获取路径
- [x] 6.2 路径节点描边变紫色，添加 CSS 呼吸灯动画（@keyframes）
- [x] 6.3 非路径节点和连线 opacity 降至 0.2
- [x] 6.4 emit('nodeClick', nodeData) 通知父组件
- [x] 6.5 响应 selectedNode prop 变化，同步高亮状态

## 7. 联调验证

- [x] 7.1 端到端：提交建模 → 决策树渲染 → 胶囊卡片显示正确
- [x] 7.2 交互：点击节点 → 路径高亮 → 路径详情面板更新
- [x] 7.3 缩放：滚轮缩放 + 拖拽平移正常工作
- [x] 7.4 反事实：点击对比按钮 → 决策树更新 → 高亮保持
