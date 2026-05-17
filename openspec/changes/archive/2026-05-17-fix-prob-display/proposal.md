## 为什么

决策树连线标签当前使用 `pathIds` → `adjustedProbMap` 查找概率值，查到的是**整条路径的累积概率**（如 path-2 = 0.25）。该标签挂在中间节点与父节点的连线上（如"上线AI → 出现严重故障"），展示 P=25%，用户会误以为是"上线AI后出现严重故障"的条件概率（实际应为 30%），造成语义误导。

## 变更内容

- **连线标签改为展示条件概率**：step > 1 的节点连线显示该事件的**条件概率**（`paths[].timeline[].probability`），而非路径累积概率
- **第一层选项节点（step=1）隐藏 P 标签**：选项是用户"选择"而非随机"事件"，不展示概率
- **调整后概率语义不变**：蒙特卡洛模拟后 `adjustedProbMap` 存在时，仍优先展示调整值
- **数据契约扩展**：DecisionTree 新增 `paths` prop 用于条件概率查找

## 功能 (Capabilities)

### 新增功能
<!-- 无新增功能 -->

### 修改功能
- `tree-probability-sync`: 决策树连线标签的概率来源从路径累积概率改为事件条件概率

## 影响

- `src/components/decision/DecisionTree.vue`: 连线标签解析逻辑重构，新增 `paths` prop
- `src/composables/useDecisionModel.js`（如需要）: 将 `paths` 数据传入决策树组件

## 非目标

- 不改变 `adjustedProbMap` 的计算逻辑或存储格式
- 不修改后端 API 返回的数据结构
- 不改变 LLM prompt 或模型返回的概率值
- 不修复路径溯源中 event→node 匹配逻辑（独立问题）
