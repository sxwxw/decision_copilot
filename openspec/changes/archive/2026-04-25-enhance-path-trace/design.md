# 设计：路径溯源深度增强

## 数据流

```
用户点击树节点
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ selectNode(node)                                         │
│                                                          │
│ 1. buildPathChain(nodeId)  →  [root, option, outcome...] │
│ 2. matchPathByChain(chain) →  matchedPath (含 timeline)   │
│ 3. 新增：enrichPathChain(chain, matchedPath)              │
│                                                          │
│    用 chain 节点名匹配 timeline 事件，注入：              │
│    - logic.impact   ← timeline[i].impact                 │
│    - logic.threshold ← timeline[i].threshold             │
│    - logic.probability ← timeline[i].probability         │
│    - meta.key_impact ← node.logic_payload.key_impact     │
│    - meta.opportunity_cost ← node.logic_payload...       │
│                                                          │
│ 输出：state.selectedNode.pathChain 每个 step 含逻辑字段  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ PathDetail.vue (trace 模式)                              │
│                                                          │
│ Computed: pathStepsWithStatus                            │
│   ├─ 遍历 pathChain 每个 step                            │
│   ├─ 读取当前 paramValues                                │
│   ├─ 计算 gap = currentValue - threshold                 │
│   ├─ 找出最大缺口（最负的 gap）作为主风险                  │
│   └─ 返回 enriched step + isRisky + statusText           │
│                                                          │
│ Computed: pathLevelAttribution                           │
│   ├─ 遍历 pathChain 所有节点的 trade_offs                │
│   ├─ 计算 |(paramValue - 50) × delta| 找最大贡献者        │
│   └─ 返回归因文案                                        │
│                                                          │
│ 渲染：                                                    │
│   综合评分 + 路径链(key_impact标注) + 归因网格 + 机会成本  │
└─────────────────────────────────────────────────────────┘
```

## 关键决策

### 1. enrichPathChain 放在哪里

放在 `selectNode` 之后、赋值给 `state.selectedNode` 之前。不碰 `adaptTree`，保持树的纯洁性。

### 2. 节点被多条路径复用时

`pathChain` 是从树构建的，`matchedPath` 是从 chain 末端匹配的路径。用 chain 节点名按顺序匹配 timeline 事件（按 step 索引对齐），不依赖名称精确匹配。

### 3. threshold 全为 0 时

直接判定为"无风险环境"，隐藏风险评估区。

### 4. delta 趋势箭头

从 `logic_payload.trade_offs` 中提取：如果该节点有 trade_offs，取 delta 总和，正数显示 ↑，负数显示 ↓。

## enrichPathChain 伪代码

```javascript
function enrichPathChain(chain, matchedPath) {
  if (!matchedPath?.timeline?.length) return chain

  const enriched = chain.map((node, idx) => {
    // 跳过根节点（root 不在 timeline 中）
    if (idx === 0) return node

    // timeline 索引对齐：step 1 → timeline[0], step 2 → timeline[1]
    const timelineIdx = idx - 1
    const evt = matchedPath.timeline[timelineIdx]

    return {
      ...node,
      displayValue: node.score, // 初始值，后续组件中实时偏移
      logic: evt ? {
        impact: evt.impact,
        threshold: evt.threshold,
        probability: evt.probability,
      } : null,
      meta: node.logic_payload ? {
        key_impact: node.logic_payload.key_impact,
        opportunity_cost: node.logic_payload.opportunity_cost,
      } : null,
    }
  })

  return enriched
}
```

## 风险判定伪代码

```javascript
function findPrimaryRisk(threshold, paramValues) {
  if (!threshold || !Object.keys(threshold).length) return null

  const gaps = Object.entries(threshold).map(([dim, thr]) => {
    const cur = paramValues[dim] ?? 50
    return { dim, gap: cur - thr }
  })

  const failing = gaps.filter(g => g.gap < 0)
  if (!failing.length) return null // 全部达标

  // 最大缺口（最负的 gap）
  failing.sort((a, b) => a.gap - b.gap)
  return failing[0]
}
```
