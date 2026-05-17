# Spec: monte-carlo-simulation

## 新增需求

### 需求:蒙特卡洛采样 NaN 防护

系统 SHALL 在蒙特卡洛采样前验证分布参数的合法性，防止 NaN/Infinity 污染全部结果。

#### 场景:均值非正数拒绝
- **当** 分布的 mean <= 0
- **那么** validateSimSpec 返回错误，不执行采样

#### 场景:分类采样概率偏置修复
- **当** 分类分布概率和不等于 1.0（偏差 <= 0.01）
- **那么** sampleCategorical 在采样前将概率归一化，不产生偏置

#### 场景:Beta 分布极端参数防护
- **当** Beta 分布的 alpha 或 beta 接近 0（< 1e-10）
- **那么** 采样器将其钳制为 1e-10，防止除以零或 NaN
