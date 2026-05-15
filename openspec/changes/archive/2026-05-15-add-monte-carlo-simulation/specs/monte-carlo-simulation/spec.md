## 新增需求

### 需求:蒙特卡洛仿真引擎

系统 SHALL 提供 `runMonteCarlo(simSpec, numSamples)` 函数，执行指定次数的蒙特卡洛抽样，返回统计结果。

#### 场景:仿真返回统计摘要
- **当** `runMonteCarlo()` 执行 5000 次抽样
- **那么** 返回 `{ p10, p50, p90, sigma, utility_mean }` 统计对象

#### 场景:仿真排名稳定性
- **当** 仿真完成且各选项效用值已计算
- **那么** 返回各选项的排名（按 utility_mean 排序）

### 需求:7 种分布抽样

系统 SHALL 支持 normal、lognormal、triangular、beta、uniform、bernoulli、categorical 七种分布类型的随机抽样。

#### 场景:normal 分布抽样
- **当** 分布类型为 normal，参数为 { mean, sd }
- **那么** 使用 Box-Muller 变换生成符合 N(mean, sd) 的随机样本

#### 场景:bernoulli 分布抽样
- **当** 分布类型为 bernoulli，参数为 { p }
- **那么** 返回 1（概率 p）或 0（概率 1-p）

### 需求:仿真结果展示

系统 SHALL 在决策结果区域展示仿真输出的 P10/P50/P90 区间和 σ 值。

#### 场景:深度模拟完成后展示统计结果
- **当** 用户点击"深度模拟"且仿真完成
- **那么** 每个选项展示：效用均值 [P10 P50 P90] σ

### 需求:counterfactual 动态生成

系统 SHALL 从 `state.model.variables` 动态生成反事实场景的参数值，而非使用硬编码变量名。

#### 场景:动态生成乐观场景
- **当** 用户选择"乐观"反事实场景
- **那么** 所有 slider 类型变量设为 80，select 类型变量设为最积极选项

#### 场景:动态生成悲观场景
- **当** 用户选择"悲观"反事实场景
- **那么** 所有 slider 类型变量设为 20，select 类型变量设为最保守选项
