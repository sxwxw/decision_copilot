# spec: simulator-correlation

## 新增需求

### 需求:蒙特卡洛变量相关性（Copula）

系统 SHALL 支持在变量的 `sim_spec` 中定义变量间的相关系数，确保抽样结果符合现实中的耦合关系。

#### 场景:定义变量间相关系数
- **当** sim_spec 包含 `correlation_matrix` 字段（对称矩阵，对角线为 1，值域 [-1, 1]）
- **那么** 抽样时使用 Gaussian Copula 或 Cholesky 分解方法生成相关样本

#### 场景:正相关变量
- **当** 变量 A 和变量 B 的相关系数 r = 0.8
- **那么** 抽样结果中 A 取高值时 B 也更可能取高值，不会大量出现"A 极高但 B 极低"的组合

#### 场景:负相关变量
- **当** 变量 A 和变量 B 的相关系数 r = -0.6
- **那么** 抽样结果中 A 取高值时 B 更可能取低值

#### 场景:无相关性（默认行为）
- **当** sim_spec 未定义 `correlation_matrix` 或 `correlation_matrix` 为单位矩阵
- **那么** 各变量独立抽样，保持当前行为不变

### 需求:相关性校验

系统 SHALL 在蒙特卡洛执行前验证协方差矩阵的合法性。

#### 场景:矩阵非对称拒绝
- **当** correlation_matrix 不是对称矩阵
- **那么** validateSimSpec 返回错误

#### 场景:矩阵非正定拒绝
- **当** correlation_matrix 不是正定矩阵
- **那么** validateSimSpec 返回错误

#### 场景:矩阵维度不匹配
- **当** correlation_matrix 的维度与 variables 数量不一致
- **那么** validateSimSpec 返回错误
