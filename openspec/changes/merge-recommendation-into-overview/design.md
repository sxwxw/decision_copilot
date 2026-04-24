## 上下文

当前 DecisionView 底部面板采用 65/35 分栏：左侧 PathDetail 展示方案概览（排名+分数），右侧 Recommendation 重复展示同一排名列表 + LLM analysis 分析文本。两个模块展示相同排名，信息重复。

## 目标 / 非目标

**目标：**
- 去除重复的 Recommendation 排名列表
- 保留 LLM analysis 文本，合并到方案概览卡片下方
- 底部面板改为 PathDetail 单栏独占

**非目标：**
- 不改变方案卡片竖排布局
- 不改变分数计算逻辑
- 不改变排名排序逻辑

## 决策

### 1. analysis 放在概览列表下方而非替代

将 `recommendation.analysis` 文本作为新卡片追加到 PathDetail overview 模式的模板中，位于 option-list 之后。这样用户先看排名，再看分析文本，符合阅读顺序。

### 2. 保留 Recommendation.vue 中的排名组件？

不需要。PathDetail overview 已经有完整的排名列表（含基准分、diff、归因文本）。Recommendation.vue 的排名功能完全被 PathDetail 覆盖，组件可以删除。

### 3. 底部布局从 flex 改为单栏

DecisionView 中 `result-bottom` 从左右分栏改为 PathDetail 单列独占。移除 `path-detail-col` 的 `flex: 0 0 65%` 和 `recommendation-col`。

## 风险 / 权衡

- [内容变长导致滚动] → PathDetail 已有 `overflow-y: auto`，analysis 卡片追加后只是滚动内容增多，不影响布局
