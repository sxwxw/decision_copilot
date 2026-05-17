# Spec: tree-probability-sync

## 修改需求

### 需求:决策树概率展示

系统 SHALL 在决策树连线标签上展示事件发生的条件概率（给定父节点后该事件发生的概率），而非路径累积概率。第一层选项节点（step=1）不展示 P 标签。

#### 场景:决策树展示条件概率
- **当** 用户完成建模并看到决策树
- **那么** step > 1 的节点连线标签显示该事件的 LLM 评估条件概率（`paths[].timeline[].probability`）
- **并且** step = 1 的选项节点连线不显示 P 标签

#### 场景:蒙特卡洛模拟后展示调整后条件概率
- **当** 用户执行蒙特卡洛模拟且 `adjustedProbMap` 非空
- **那么** step > 1 的节点连线标签优先使用 `adjustedProbMap[pathId]` 中的调整值
- **并且** 如果 `adjustedProbMap` 中无对应 pathId 则 fallback 到基准条件概率

#### 场景:调参不改变决策树概率标签
- **当** 用户调整参数滑块且未执行蒙特卡洛模拟
- **那么** 决策树上的概率标签保持不变
- **并且** 不触发任何概率重算逻辑

### 需求:ForkComparison 概率展示

系统 SHALL 在 ForkComparison 分叉卡片中展示条件概率，取自节点的 `probability` 字段，而非路径累积概率。

#### 场景:ForkComparison 展示条件概率
- **当** 用户处于分叉对比模式
- **那么** 每个子分支的概率展示使用 `child.probability`（条件概率）
- **禁止** 使用 `adjustedProbMap[pathId]` 覆盖条件概率值
