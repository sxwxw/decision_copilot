# spec: tree-probability-sync

## 需求

### 决策树展示调整后的概率

- 系统 SHALL 在决策树连线标签中展示经过 `adjustedProbabilities` 计算后的概率值，而非静态的初始概率

#### 场景:参数调整后树概率更新

- **当** 用户拖动参数滑块触发 `recalcScores()`
- **那么** 决策树连线标签 `P=XX%` 展示调整后的概率值

#### 场景:无调整概率时回退

- **当** `adjustedProbMap` 中不存在某节点的概率值
- **那么** 决策树连线标签展示该节点的原始 `probability` 字段

### 树节点注入路径映射

- 系统 SHALL 通过 `adaptTree` 为每个节点注入 `pathIds` 数组，建立节点到 path 的映射关系

#### 场景:节点包含关联的 path 标识

- **当** `adaptTree` 处理树节点时
- **那么** 节点的 `pathIds` 数组包含所有经过该节点的 path.id
