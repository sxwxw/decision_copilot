<!--
 * @Author: wxw
 * @Date: 2026-04-25 12:56:50
 * @LastEditors: wxw
 * @LastEditTime: 2026-04-25 13:05:00
 * @FilePath: \decision_copilot\openspec\changes\export-report\tasks.md
-->

# 任务：构建专业级 HTML 报告导出系统

## 1. 基础架构与依赖

- [x] 1.1 安装导出核心：`npm install html2canvas jspdf`
- [x] 1.2 创建导出工具类 `src/utils/exportReport.js`：
  - 接收 DOM 容器引用，调用 html2canvas 截图
  - 遍历容器子 Section，每个 Section 独立 `addPage()` 粘贴，规避截断
  - 触发浏览器下载（文件名：`decision-report-{timestamp}.pdf`）
- [x] 1.3 在 `App.vue` 中预留离屏容器 `#report-target`（`position: absolute; left: -9999px`）

## 2. 报告模板组件 (`ReportTemplate.vue`)

- [x] 2.1 **书面化布局设计**：
  - A4 标准宽度 (210mm)，强制白底黑字，页边距 25mm
  - 页眉：2px 粗黑线 + 1px 细灰线（咨询报告风格）
  - H2 标题使用 `border-left` 装饰增强"公文感"
  - 对比数据：正向偏移加粗黑体，负向偏移灰色，不用红绿保持商务冷感

- [x] 2.2 **三页强制分页结构**（每 Section `height: 297mm`）：

  **Section 1: 决策背景与参数快照**
  - Header: "PREMIUM DECISION REPORT" + 导出时间
  - 焦点路径：*"焦点路径：[方案名] > [末梢节点名]"*
  - Context: 原始决策问题摘要
  - Weight Table: 当前滑块值 vs 默认值(50)的偏移对比表

  **Section 2: 深度路径推演（竖向时间轴）**
  - 将横向 pathChain 转为竖向时间轴：左侧 1px 灰线贯穿，节点处黑色实心圆点
  - 每步展示：`title`(step.name)、`score`(displayValue)、`impact`(meta.key_impact)、`status`(风险标识)
  - 数据源：`state.selectedNode.pathChain`

  **Section 3: 执行摘要与归因**
  - Executive Summary: `recommendation.analysis` + `delta_analysis`
  - 方案排名对比表（所有 Option 得分，非仅当前路径）
  - Footnote: 醒目标注 `opportunity_cost`
  - 风险等级印章："稳健/紧平衡/高风险"

- [x] 2.3 **PDF 专项样式优化**：
  - 移除所有按钮、阴影和过渡动画
  - 每个 Section 设置 `height: 297mm`，独立分页
  - `page-break-inside: avoid` 保护表格和时间轴节点不被切割

## 3. 导出交互逻辑

- [x] 3.1 在 `PathDetail.vue` 底部添加导出入口：
  - 按钮文字："导出深度分析报告 (PDF)"
  - 状态管理：`isExporting` loading 状态

- [x] 3.2 **导出触发链路**：
  1. 点击按钮 → 设置 `isExporting = true`
  2. 渲染 `ReportTemplate` 到 `#report-target` 离屏容器
  3. 传入 `state.selectedNode` 上下文，确保报告锚定当前选中节点
  4. 调用 `html2canvas` 抓取离屏 DOM
  5. `jsPDF` 逐页生成并执行下载
  6. 清空离屏容器 → 设置 `isExporting = false`

## 4. 报告内容深度增强

- [x] 4.1 **偏移归因文案**：对比默认 50 分与当前分的差异，生成书面解释
- [x] 4.2 **风险等级标识**：基于 pathChain 的 threshold 缺口判定，加盖"稳健/紧平衡/高风险"印章
