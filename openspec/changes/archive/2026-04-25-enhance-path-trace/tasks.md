# 任务：路径溯源深度增强

## 1. 新增 `enrichPathChain` 函数
- [x] 1.1 在 `src/composables/useDecisionModel.js` 中新增 `enrichPathChain(chain, matchedPath)` 函数
  - 用 chain 节点名匹配 timeline 事件，按 step 索引对齐（step 1 → timeline[0]）
  - **匹配策略**：`stepName.includes(eventName) || eventName.includes(stepName) || index === timelineIdx`（语义包含 + 索引保底，确保数据流不断裂）
  - 注入 `logic.{impact, threshold, probability}` 和 `meta.{key_impact, opportunity_cost}`
  - 跳过根节点（idx=0）

## 2. 集成到 `selectNode`
- [x] 2.1 在 `selectNode` 中调用 `enrichPathChain`，注入结果附加到 `state.selectedNode.pathChain`

## 3. PathDetail.vue 重构 trace 视图
- [x] 3.1 添加数据摘要区：显示"到达总概率：X%"和"综合评分：Y"
- [x] 3.2 重写路径链可视化：节点间箭头标注 `key_impact` + delta 趋势（↑/↓）
  - **颜色约定**：delta > 0 使用蓝色/绿色（--el-color-primary），delta < 0 使用灰色（--el-text-color-secondary）
  - 红色仅预留给风险评估区，delta 负值是客观属性不是危险
- [x] 3.3 新增实时风险评估 computed：
  - 计算各维度 `gap = currentValue - threshold`
  - 最大缺口策略定位首要风险
  - 安全/危险/多风险累计三种文案
- [x] 3.4 新增路径级归因 computed：
  - 遍历 pathChain 节点的 trade_offs（跳过根节点）
  - 找 `(paramValue - 50) × delta` 绝对值最大的环节
  - **跳过根节点**：如果最大绝对值来自根节点，顺延取下一个
  - 生成细化到节点的归因文案
- [x] 3.5 新增机会成本展示区

## 4. 视觉反馈
- [x] 4.1 节点不达标时加 2px 红色底边
- [x] 4.2 threshold 全为 0 时隐藏风险评估区
