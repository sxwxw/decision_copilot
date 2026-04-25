# 设计：trade_offs 加权推导

## 数据流

```
清洗后的 treeData + paths
        │
        ▼
┌─────────────────────────────────────────────────────┐
│ deriveTradeoffs(treeData, paths, weights)           │
│                                                     │
│ 1. 对每个 option (treeData.children[i])：           │
│    a. 收集已有 trade_offs 的 dimensions             │
│    b. 找出 weights 中有但 trade_offs 中缺失的维度    │
│    c. 对每个缺失维度：                              │
│       - 遍历该 option 的 L1 children                │
│       - 用 path.name 匹配 L1 节点到对应 path        │
│       - 如果 L1 节点的 logic_payload.trade_offs     │
│         包含该维度，记录 (delta × path.probability) │
│       - 加权平均：Σ(delta×prob) / Σ(prob)           │
│    d. 注入推导出的 {dimension, delta} 到            │
│       option 级 trade_offs                          │
│                                                     │
│ 2. 如果所有子节点都没有该维度，注入 delta=0          │
│                                                     │
│ 输出: 补全 trade_offs 的 treeData                    │
└─────────────────────────────────────────────────────┘
```

## 关键决策

### 为什么用 path.probability 而不是 node.value

path.probability 是路径级的到达概率，更准确地反映了"这个子节点被走到的可能性"。用 node.value 会忽略路径级别的概率分布。

### 为什么用加权平均而不是求和

如果直接求和，子节点越多 delta 越大，不同选项间就不公平了。加权平均保持了量级一致性。

### 位置

放在 `sanitizeModel` 的 Step 1e（trade_offs 过滤）之后、Step 2（语义索引）之前。因为需要先过滤掉非法 dimension，再推导缺失的。
