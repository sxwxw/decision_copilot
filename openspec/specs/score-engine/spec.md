# spec: score-engine

## 新增需求

### 需求:统一评分计算公式

系统 SHALL 提供唯一的评分公式实现 `calcScoreOffset(pv, base, delta, weight)`，消除多处重复实现。公式为：`(pv - base) * delta * 2 / 100 * weight`。

#### 场景:正常评分偏移计算
- **当** pv=75, base=50, delta=0.3, weight=1.0
- **那么** calcScoreOffset 返回 0.15

#### 场景:默认 base 为 50
- **当** 调用 calcScoreOffset(60, 50, 0.5) 不传 base
- **那么** 返回 (60-50)*0.5*2/100*1 = 0.1

#### 场景:pv 等于 base 时偏移为零
- **当** pv=50, base=50, delta=0.3, weight=1.0
- **那么** calcScoreOffset 返回 0

#### 场景:复合评分计算
- **当** 计算复合评分时需要传入 Decimal.js 高精度版本 calcScoreOffsetDecimal
- **那么** 高精度版本与原生版本在输入值相同时返回相同结果（误差 < 1e-10）

### 需求:评分归因计算

系统 SHALL 提供独立的评分归因引擎 `getScoreAttribution`，计算每个维度对评分变化的影响程度，返回影响最大的维度。

#### 场景:单维度归因
- **当** 只有一个维度的 delta > 0，其他维度 delta = 0
- **那么** 该维度被识别为 topImpactDimension，impact 值等于其偏移量

#### 场景:多维度归因排序
- **当** 多个维度有不同 delta 值
- **那么** 返回按 |impact| 降序排列的维度列表
