## 为什么

当前敏感性依赖用户手动拖滑块看变化，用户能看变化但不知道"排名稳不稳"。如果两个选项分数只差 1%，但用户不知道这个差距是否显著。

## 变更内容

新增自动敏感性分析：对每个变量做 ±20% 扰动，记录排名变化，计算稳定性指标（stable/partially_stable/unstable）和第一名 vs 第二名的差距百分比。

## 功能 (Capabilities)

### 新增功能

- `sensitivity-analysis`: 自动敏感性分析，计算排名稳定性和关键变量

### 修改功能

- `decision-core`: state.model 新增 `sensitivity` 字段存储分析结果

## 影响

- `src/composables/useDecisionModel.js` 新增 `runSensitivity()` 方法
- 前端底部面板新增"敏感性分析"tab
- 可能复用已有的 echarts 绘制雷达图
