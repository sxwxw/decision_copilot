## 新增需求

### 需求:调整后概率归一化

系统 SHALL 在 `recalcProbabilities()` 计算出所有路径的调整后概率后，执行归一化，确保所有路径概率总和 ≈ 1.0（允许 ±0.01 的浮点误差）。

#### 场景:归一化计算
- **当** `recalcProbabilities()` 完成调整计算
- **那么** 所有 `adjustedProbabilities` 值之和与 1.0 的差值 ≤ 0.01

#### 场景:概率总和为零时的均匀分配
- **当** 所有调整后的原始概率之和为 0
- **那么** 系统 SHALL 将概率均匀分配给所有路径（每条路径 = 1 / 路径数量）

### 需求:alignment 量纲对齐

系统 SHALL 在 alignment 计算中将 impact delta（-100~100）映射到 0~100 偏好空间后再与 userVal 比较。

#### 场景:impact 映射
- **当** 计算 alignment 时使用 impact 值
- **那么** impact 应先经过 `impactMapped = (impact + 100) / 2` 映射到 [0, 100] 范围

#### 场景:alignment 范围
- **当** userVal 和 impactMapped 都在 [0, 100] 范围内
- **那么** alignment 的值在 [0, 1] 范围内
