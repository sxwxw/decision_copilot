# 提案：trade_offs 加权推导

## 问题

LLM 在 option 级 trade_offs 中只挑选它认为"区分度最大"的 2 个维度，导致有权重的维度（如"短期收益"权重 0.25）在 trade_offs 中完全缺失。用户拖动这些维度的滑块时，`recalcScores` 公式中 delta=0，分数无变化。

## 解决方案

在清洗器中，如果某维度有权重但不在 option 级 trade_offs 中，从该选项的子节点（L1/L2）的 trade_offs 中提取对应 delta，按路径概率加权平均，注入回 option 级。

### 推导公式

```
delta_option(d) = Σ(delta_child(d) × path_probability_for_child) / Σ(path_probability_for_child)
```

例如"优化核心"的"短期收益"：
- "体验跃升" delta=20, path-1 prob=0.72 → 20 × 0.72 = 14.4
- "增长见顶" 无短期收益 → 跳过
- delta = 14.4 / 0.72 = 20（加权平均）

### 同时在 prompt 中强化要求：所有出现在 weights 中的维度必须在至少一个选项的 trade_offs 中出现。
