# 设计文档

## 决策

### 为什么在 `useDecisionModel.js` 做适配，而不是在组件内？

组件的职责是"渲染"，不是"理解数据"。把适配推到上游意味着：
- DecisionTree.vue 的输入永远是标准化的，不需要猜测任何业务语义
- 未来换 LLM provider 或数据结构变化时，只改适配器不动组件
- 适配器可以处理 LLM 输出的各种不规范情况（前缀、缺失字段、单分支路径等）

### 为什么用 `adaptTree` 递归函数而不是遍历补丁？

递归方案在树构建时一次性完成所有字段映射（字段重命名 + ID 分配 + 概率注入），比在组件内做字符串匹配可靠得多，且性能更好。

### 向后兼容策略

适配器兼容旧字段名（`year`→`step`、`value`→`score`、`eventType`→`status`），确保现有 mock 数据和 LLM 输出无需改动即可工作。

## 数据流

```
LLM 输出                    适配器                      组件
─────────                   ───────                    ──────
treeData {              ┌─> adaptTree() ──────────>  treeData {
  name: "今日菜单"        │    name: "今日菜单"
  year: 0       ────────┤    step: 0
  value: 100             │    score: 100
  children: [...]        │    id: "n-1"
}                        │    probability: 1.0
paths: [...]             │    isDashed: false
                         │    children: [...]
                         │  }
                         │
                         └─> eventProbMap（从 paths.timeline 累积概率）
                              注入到对应节点的 probability 字段
```

## 关键实现

### `adaptTree` 核心逻辑

```
1. 从 paths.timeline 构建 eventProbMap:
   key = "step-{year}:{event}" → cumulativeProbability

2. 递归遍历 treeData:
   - name → 去除 "第N年：" 前缀
   - year → step（深度层级）
   - value → score
   - eventType → status
   - probability → 从 eventProbMap 查或 fallback 到 score/100
   - isDashed → step >= 2
   - id → 自增序列 "n-1", "n-2", ...
```

### 组件契约变更

| 旧字段      | 新字段        | 类型             |
|-------------|---------------|------------------|
| `year`      | `step`        | number           |
| `value`     | `score`       | number           |
| `eventType` | `status`      | string\|null     |
| —           | `id`          | string (新增)    |
| —           | `probability` | number (新增)    |
| —           | `isDashed`    | boolean (新增)   |
