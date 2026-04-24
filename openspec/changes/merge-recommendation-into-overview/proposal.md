## 为什么

方案概览（PathDetail overview）和推荐结论（Recommendation）展示的内容高度重合：同一套排名、同一组分数。用户需要同时看两块才能获取完整信息，而底部 65/35 分栏中 35% 的区域只复用了一遍已有的排名，信息密度低。

## 变更内容

- 移除 Recommendation 组件及底部右侧 35% 栏
- 将 LLM 的 `analysis` 分析文本以卡片形式追加到方案概览卡片下方
- 方案卡片保持竖排布局不变
- 底部面板变为 PathDetail 独占单栏

## 功能 (Capabilities)

### 新增功能

无

### 修改功能

- `decision-view-layout`: 底部面板从左右分栏（PathDetail 65% + Recommendation 35%）改为 PathDetail 单栏独占，推荐结论的 analysis 内容合并入方案概览

## 影响

- 删除 `src/components/decision/Recommendation.vue`
- 修改 `src/views/DecisionView.vue`：移除 Recommendation 列及对应分栏样式
- 修改 `src/components/decision/PathDetail.vue`：overview 模式追加 analysis 卡片

## 非目标

- 不改变方案卡片的竖排布局
- 不改变评分计算公式
- 不改变推荐排名逻辑（排名已在 PathDetail overview 中展示）
