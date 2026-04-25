# 提案：trade_offs 加权推导

## 为什么

LLM 在 option 级 trade_offs 中只挑选它认为"区分度最大"的 2 个维度，导致有权重的维度在 trade_offs 中完全缺失。用户拖动这些维度的滑块时，分数无变化，动态评分失效。

## 变更内容

在清洗器中新增 `deriveTradeoffs` 函数，如果某维度有权重但不在 option 级 trade_offs 中，从该选项的子节点（L1/L2）的 trade_offs 中提取对应 delta，按路径概率加权平均，注入回 option 级。同时在建模 Prompt 中强化要求：所有出现在 weights 中的维度必须在至少一个选项的 trade_offs 中出现。
