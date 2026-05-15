## 修改需求

### 需求:Delta 范围约束

所有建模 prompt 必须约束 trade_offs.delta 的绝对值不超过 20，且同一维度在不同选项之间的 delta 差值不超过 30。`DECISION_MODEL_PROMPT`、`DECISION_MODEL_DEEP_PROMPT` 和 `DECISION_REFINE_PROMPT` 均须包含此约束。

#### 场景:LLM 建模时 delta 受限
- **当** LLM 为模型的 trade_offs 生成 delta 值
- **那么** 每个 delta 的绝对值必须 ≤ 20

#### 场景:同维度跨选项 delta 差值受限
- **当** 同一维度在多个选项的 trade_offs 中出现
- **那么** 任意两个选项在此维度的 delta 差值绝对值 ≤ 30

### 需求:评分公式纳入权重乘数

前端评分计算和蒙特卡洛仿真中，权重必须作为乘数参与偏移计算。当前公式 `offset = (paramValue/100 - 0.5) * delta * 2` 必须修改为 `offset = (paramValue/100 - 0.5) * delta * 2 * weight`。

#### 场景:高权重维度偏移更大
- **当** 某变量权重为 0.3，用户参数值偏离中点
- **那么** 该变量的偏移量乘以 0.3 作为权重因子

#### 场景:低权重维度偏移更小
- **当** 某变量权重为 0.1，用户参数值偏离中点
- **那么** 该变量的偏移量乘以 0.1，影响显著减小
