# spec: trade_offs 加权推导

## ADDED Requirements

### 需求:加权推导缺失维度

系统必须在清洗阶段为缺失有权重维度的选项推导 delta 值。

#### 场景:option 级 trade_offs 中缺失有权重的维度

- **当** 存在有权重的维度（如"短期收益"权重 0.25）
- **并且** 该维度不在某选项的 trade_offs 中
- **那么** 从该选项的子节点（L1 outcome）中提取该维度的 delta

#### 场景:按路径概率加权平均

- **当** 子节点在对应路径的 trade_offs 中有该维度的 delta
- **那么** delta = Σ(delta_child × path_probability) / Σ(path_probability_for_child)

#### 场景:子节点无对应维度时跳过

- **当** 某子节点在该维度上也没有 trade_offs 条目
- **那么** 该子节点不计入该维度的推导

#### 场景:所有子节点都没有该维度

- **当** 该选项下所有子节点的 trade_offs 中都没有该维度
- **那么** 注入 delta=0 作为兜底

#### 场景:维度已在 trade_offs 中时不覆盖

- **当** 某维度已存在于选项的 trade_offs 中
- **那么** 保留原始值，不做修改

### 需求:Prompt 强化

系统必须在建模 Prompt 中要求 trade_offs 覆盖所有权重维度。

#### 场景:建模 Prompt 要求全覆盖

- **当** 生成决策模型 JSON
- **那么** 所有出现在 weights 中的维度必须在至少一个选项的 trade_offs 中出现
