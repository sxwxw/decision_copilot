# spec: value-of-information

## 新增需求

### 需求:信息价值分析（EVIU）

系统 SHALL 利用蒙特卡洛仿真结果计算信息价值（Expected Value of Imperfect Information），识别"最值得先调研以降低不确定性"的变量。

#### 场景:计算单变量的 EVIU
- **当** 调用 valueOfInformation.analyze(monteCarloResult, currentRanking, variableName)
- **那么** 返回该变量的 EVIU 值，表示"如果完全掌握该变量真实值，能挽回的期望损失"

#### 场景:识别最高 EVIU 变量
- **当** 存在多个变量具有不同敏感度和不确定性
- **那么** 返回按 EVIU 降序排列的变量列表

#### 场景:生成调研建议
- **当** 某变量同时具有高敏感度（sensitivity-engine 输出）和高 EVIU
- **那么** 生成提示："变量 X 的不确定性最高且对结果最敏感，建议优先调研；如能将变量 X 的误差缩小到 ±Y%，该决策的置信度将提升 Z%"

### 需求:EVIU 计算精度

系统 SHALL 基于已有蒙特卡洛样本计算 EVIU，不额外增加抽样次数。

#### 场景:利用现有仿真结果
- **当** monteCarloResult 包含 5000 次样本
- **那么** EVIU 从这 5000 次样本中分组计算，不触发新抽样
