# 规范：trade_offs 加权推导

## 需求：加权推导缺失维度

### 场景：option 级 trade_offs 中缺失有权重的维度

**Given** 存在有权重的维度（如"短期收益"权重 0.25）
**And** 该维度不在某选项（如"优化核心"）的 trade_offs 中
**When** 执行 `deriveTradeoffs`  
**Then** 从该选项的子节点（L1 outcome）中提取该维度的 delta

### 场景：按路径概率加权平均

**Given** 子节点在对应路径的 trade_offs 中有该维度的 delta
**When** 执行加权推导  
**Then** delta = Σ(delta_child × path_probability) / Σ(path_probability_for_child)

### 场景：子节点无对应维度时跳过

**Given** 某子节点在该维度上也没有 trade_offs 条目
**When** 执行加权推导  
**Then** 该子节点不计入该维度的推导（不参与分子分母）

### 场景：所有子节点都没有该维度

**Given** 该选项下所有子节点的 trade_offs 中都没有该维度
**When** 执行加权推导  
**Then** 注入 delta=0 作为兜底

### 场景：维度已在 trade_offs 中时不覆盖

**Given** 某维度已存在于选项的 trade_offs 中
**When** 执行加权推导  
**Then** 保留原始值，不做修改

## 需求：Prompt 强化

### 场景：建模 Prompt 要求全覆盖

**Given** `DECISION_MODEL_PROMPT` 和 `DECISION_MODEL_DEEP_PROMPT` 中包含 trade_offs 约束
**When** 生成 JSON  
**Then** 所有出现在 weights 中的维度必须在至少一个选项的 trade_offs 中出现
