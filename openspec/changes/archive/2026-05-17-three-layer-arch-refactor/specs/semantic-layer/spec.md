# Spec: semantic-layer

## 新增需求

### 需求:LLM 仅输出定性标签

大模型 MUST 仅负责抽取定性因果标签（如"极高"、"高"、"中"、"低"、"极低"概率；"强正向"、"弱负向"等 delta），禁止直接输出精确的概率数值（0-1）和权重绝对值（0-1）。

#### 场景:建模步骤输出定性概率

- **当** LLM 执行 DECISION_MODEL_DEEP_PROMPT
- **那么** paths[].probability_label MUST 为枚举值之一：`极高 | 高 | 中 | 低 | 极低`，而非浮点数

#### 场景:建模步骤输出定性 delta

- **当** LLM 执行 DECISION_MODEL_DEEP_PROMPT
- **那么** trade_offs[].delta_label MUST 为枚举值之一：`强正向 | 中正向 | 弱正向 | 无影响 | 弱负向 | 中负向 | 强负向`，而非具体数值

#### 场景:Prompt 明确禁止数值输出

- **当** 任何 Prompt 被发送给 LLM
- **那么** system prompt 中 MUST 包含"禁止输出精确概率/权重数值，使用定性标签替代"的约束条款

### 需求:动态双轨解析器

系统 MUST 在 sanitizeModel 中实现双轨解析：当 LLM 输出纯数字时反向转换为标签再映射，当输出标签时正常查表映射，确保管线不因字段类型冲突而击穿。

#### 场景:LLM 惯性输出数值

- **当** LLM 在 probability 字段输出纯数字（如 0.7）
- **那么** 系统 MUST 将其反向转换为对应标签（0.7 ∈ [0.60, 0.80] → "高"），再过统一归一化引擎

#### 场景:LLM 正确输出标签

- **当** LLM 输出 probability_label 为"高"
- **那么** 系统 MUST 查表映射为基准值 0.70

## 修改需求

### 需求:Pipeline SSE 流管理

系统 SHALL 支持 LLM 输出定性标签后的数据完整性校验。

#### 场景:定性标签字段存在性校验

- **当** LLM 返回建模结果
- **那么** 每个路径节点 MUST 包含 `probability_label` 或 `probability` 字段，否则标记为数据缺失
