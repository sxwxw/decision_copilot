# 任务：初始化决策辅助器

## 阶段1：基础架构 + Mock 开发

- [x] 1.1 安装前端依赖：echarts、vue-echarts、axios
- [x] 1.2 创建 `src/router/index.js` 和 `src/views/DecisionView.vue`（三栏布局骨架）
- [x] 1.3 创建 `src/components/decision/` 下所有组件骨架
  - `InputPanel.vue`、`ParamPanel.vue`、`ResultPanel.vue`
  - `DecisionTree.vue`、`PathDetail.vue`、`Recommendation.vue`
- [x] 1.4 创建 `src/components/common/` 通用组件
  - `ParamSlider.vue`、`ParamSelect.vue`、`MetricCard.vue`
- [x] 1.5 创建 `src/composables/useDecisionModel.js`（状态管理）
- [x] 1.6 创建 `server/mock/decisionModel.json`（Mock 数据）
- [x] 1.7 创建 `src/api/decision.js`（API 封装，支持 mock/真实切换）
- [x] 1.8 接入 ECharts 决策树渲染 + 点击高亮交互
- [x] 1.9 实现前端本地权重重算逻辑

## 阶段1.5：决策推演系统升级

- [x] 1.10 升级 mock 数据结构：为 treeData 节点增加 `year`、`eventType`、`probability` 字段
- [x] 1.11 升级 paths 数据：为每条路径增加 `timeline` 字段（时间线事件 + 影响指标）
- [x] 1.12 改造 `PathDetail.vue`：从指标卡片改为时间线叙事视图
- [x] 1.13 改造 `DecisionTree.vue`：节点显示概率值和 eventType 颜色标识
- [x] 1.14 实现 `recalcProbabilities()`：参数变化联动路径概率的计算逻辑
- [x] 1.15 为 `Recommendation.vue` 添加反事实对比按钮组
- [x] 1.16 实现反事实场景的自动调参 + diff 对比展示
- [x] 1.17 优化布局细节：决策树容器可滚动、防止文字遮挡，result-tree 与 result-bottom 推拉门布局

## 阶段1.6：UI 布局重构

- [x] 1.18 重构 DecisionView 布局：ParamPanel 移入左侧栏与 InputPanel 堆叠滚动，底部栏改为 PathDetail(65%) + Recommendation(35%) 两栏
- [x] 1.19 改造 PathDetail.vue：推演过程 timeline 置顶并与 2x2 指标卡片水平并排

## 阶段2：后端 Express + 联调

- [x] 2.1 初始化 Express 后端（`server/index.js`）
- [x] 2.2 创建 `server/routes/decision.js`（路由）
- [x] 2.3 创建 `server/services/llmService.js`（Qwen 调用封装）
- [x] 2.4 创建 `server/prompts/decisionModel.js`（Prompt 模板，含 timeline 输出格式）
- [x] 2.5 配置 Vite proxy 转发 `/api/*` 到 Express
- [x] 2.6 用 Mock 数据替换为真实后端调用

## 阶段3：全链路测试

- [x] 3.1 端到端流程：输入 → 建模 → 参数面板 → 决策树 → 路径详情
- [x] 3.2 调参重算：改权重 → 本地重算概率和分数 → 树/结论更新
- [x] 3.3 反事实对比：点击对比按钮 → 参数自动调整 → 可视化差异
- [x] 3.4 深度推演：点击路径 → 后端展开详情
