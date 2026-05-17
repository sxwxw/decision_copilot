# Spec: tree-probability-sync

## 修改需求

### 需求:决策树概率展示

系统 SHALL 在决策树连线标签上展示 LLM 返回的基准概率值，概率不随用户调参变化。

#### 场景:决策树展示基准概率
- **当** 用户完成建模并看到决策树
- **那么** 每条连线标签显示该节点对应的 LLM 原始累积概率
- **并且** 概率值取自节点 `probability` 字段

#### 场景:调参不改变决策树概率
- **当** 用户调整参数滑块
- **那么** 决策树上的概率标签保持不变
- **并且** 不触发任何概率重算逻辑

### 需求:概率同步

系统 SHALL 在建模完成后将 LLM 返回的路径概率直接赋值给 `state.adjustedProbabilities`，不再执行对齐度缩放和归一化。

#### 场景:建模完成后初始化概率
- **当** `buildModel` 或 `runPipeline` 完成
- **那么** `state.adjustedProbabilities` SHALL 按 pathId 存储 LLM 返回的原始 `path.probability`
- **禁止** 使用 `recalcProbabilities` 执行 alignment/scale/normalize 计算

## 移除需求

### 需求:recalcProbabilities 概率重算

**Reason**: 原公式 `alignment = 1 - |userVal - (50 + impactVal)| / 100` 中 `50 + impactVal` 超出用户输入范围（0-100），导致 alignment 永远达不到 1.0。且概率重算的语义假设（用户偏好方向 = 事件发生概率变化）不成立——概率应由 LLM 评估，前端公式无法正确模拟。

**Migration**: `recalcScores` 中移除对 `recalcProbabilities` 的调用；`recalcProbabilities` 函数本身保留但仅含空实现或废弃标记。建模时概率初始化由 `buildModel`/`runPipeline` 直接赋值完成。
