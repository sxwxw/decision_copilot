## 1. 布局调整

- [ ] 1.1 修改 `DecisionView.vue`：移除 Recommendation 组件引用和 recommendation-col 分栏，result-bottom 改为 PathDetail 单栏独占
- [ ] 1.2 清理 `DecisionView.vue`：移除不再需要的 props 传递（recommendation、getScoreDiff、counterfactual 相关）和 import

## 2. 方案概览追加 analysis

- [ ] 2.1 修改 `PathDetail.vue` overview 模板：在 option-list 下方追加 analysis 卡片，使用 `state.model.recommendation.analysis`
- [ ] 2.2 添加 analysis 卡片的 scoped 样式，保持与现有卡片风格一致

## 3. 删除 Recommendation 组件

- [ ] 3.1 删除 `src/components/decision/Recommendation.vue`
- [ ] 3.2 确认无其他文件引用 Recommendation.vue
