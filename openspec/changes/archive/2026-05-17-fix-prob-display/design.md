## 上下文

当前决策树连线标签使用 `pathIds → adjustedProbMap → node.probability` 优先级查找概率值。对于带 `pathIds` 的节点，`adjustedProbMap` 查到的是整条路径的累积概率（如 path-2 = 0.25），该值挂在中间节点与父节点的连线上，展示 P=25%，用户误以为是"上线AI后出现严重故障"的条件概率（实际应为 30%）。

根因：`paths[].probability` 是整条路径的联合概率，而 `paths[].timeline[].probability` 才是每个事件的条件概率。当前连线标签取的是前者，语义错误。

## 目标 / 非目标

**目标：**
- step > 1 的连线标签展示条件概率（`paths[].timeline[].probability`）
- step = 1 的选项节点连线不显示 P 标签
- 蒙特卡洛模拟后 `adjustedProbMap` 存在时仍优先使用调整值

**非目标：**
- 不改变 `adjustedProbMap` 的计算逻辑或存储格式
- 不修改后端 API 返回的数据结构
- 不改变 LLM 返回的概率值

## 决策

### 1. 新增 `paths` prop 到 DecisionTree 组件

DecisionTree 需要访问 `paths` 数据来查找 `timeline` 中的条件概率。当前组件只有 `treeData`、`selectedNode`、`adjustedProbMap`。新增 `paths` prop 作为可选参数。

**替代方案：** 在 treeAdapter 中将条件概率烘焙到节点数据上（如 `conditionalProbability` 字段）。但由于 LLM 返回的树节点已有 `probability` 字段（虽然语义不同），引入新字段可能造成歧义。选择直接在 DecisionTree 中通过 `paths` prop 查找，逻辑更透明。

### 2. 条件概率查找策略：通过 pathId → timeline 事件名匹配

每个节点 `d.data.pathIds` 可能包含多个 pathId。对每个 pathId，在 `paths[]` 中找到该 path，然后在其 `timeline[]` 中匹配 `event === d.data.name` 的条目，取出其 `probability`。

如果同一节点被多条路径共享且各路径中该事件的 probability 不同，取第一条匹配到的路径中的值。这在语义上正确，因为 LLM 返回的多条路径中同一事件的概率应一致。

### 3. step=1 节点隐藏 P 标签

在 `renderTree()` 中，对 `d.target.data.step === 1` 的连线标签返回空字符串。

### 4. adjustedProbMap 优先级不变

`adjustedProbMap` 存在且非空时，仍然优先使用调整值。蒙特卡洛模拟后的调整概率也是条件概率的模拟版本，语义一致。

## 风险 / 权衡

- **事件名匹配可能因 LLM 输出不一致而失败**：如果 `timeline[].event` 与 `node.name` 不完全匹配，fallback 到 `node.probability`。这是已有行为，不会恶化。
- **adjustedProbMap 中存储的仍是路径累积概率**：当前 `adjustedProbMap` 的 key 是 pathId，value 是路径概率。蒙特卡洛模拟后展示在连线上的调整概率仍是路径级别的，不是事件级别的条件概率。本变更不改变 `adjustedProbMap` 的格式——因为蒙特卡洛模拟本身输出就是路径级分布，不是事件级。这是已知限制，但不影响基线展示的修正。
