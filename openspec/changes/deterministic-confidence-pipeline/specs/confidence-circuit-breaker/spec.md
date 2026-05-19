# Spec: confidence-circuit-breaker

## 新增需求

### 需求:三锁熔断机制

系统 SHALL 在 Nexus 步骤完成后执行三级熔断校验，确保最终置信度分数基于确定性代码计算而非 LLM 主观判断。

#### 场景:第一锁 — 静态校验 ERROR 触发强制死线
- **当** `validateModel()` 返回包含 `severity: "error"` 的校验结果
- **那么** 系统 MUST 将最终置信度强制限制在最高 45 分

#### 场景:第一锁 + 第二锁同时触发 — 双重 ERROR 锁死
- **当** 静态校验存在 ERROR 且蒙特卡洛仿真引擎报告不收敛
- **那么** 系统 MUST 将最终置信度强制锁死在 15 分

#### 场景:WARNING 执行梯度扣分
- **当** 管线中存在 WARNING 级别的信号（如因果循环、仿真轻微波动、非核心字段缺失）
- **那么** 系统 MUST 按硬性扣减表计算总分：TOPOLOGY_LOOP 扣 5 分、SIMULATION_OSCILLATION 扣 3 分、MINIMAL_DATA_MISSING 扣 2 分

#### 场景:最终分数计算公式
- **当** Nexus 输出 `confidence_label` 被映射为基准分
- **那么** 最终分数 = 基准映射分 - Σ(触发的 WARNING 扣分)，且不得低于 0

#### 场景:v2_system_alerts 白盒协议
- **当** 第一锁或第二锁被触发
- **那么** 返回结果中 MUST 包含 `v2_system_alerts` 数组，每个元素包含 `type`、`severity`、`message`、`override_details` 字段

### 需求:拓扑完备性校验

系统 SHALL 在 `validateModel()` 中新增拓扑结构检查，包括孤立节点检测和断头路检测。

#### 场景:检测孤立节点
- **当** treeData 中存在有父无子或有子无父的节点（非叶子/非根节点）
- **那么** 系统 MUST 返回 `severity: "error"` 的校验错误

#### 场景:检测断头路
- **当** 某条路径中途终止且无终审损益表现
- **那么** 系统 MUST 返回 `severity: "error"` 的校验错误

### 需求:因果循环检测

系统 SHALL 在 `validateModel()` 中检测因果树中的拓扑环路。

#### 场景:检测到因果循环
- **当** treeData 中存在 A → B → C → A 的因果链回路
- **那么** 系统 MUST 返回 `severity: "warning"` 的校验结果，标识环路涉及的节点

#### 场景:正反馈回路不误杀
- **当** 因果循环属于合理的正反馈调节（如用户增长 → 营收 → 研发 → 用户增长）
- **那么** 系统 MUST 返回 WARNING 而非 ERROR，允许 Nexus 自行判断

## 修改需求

### 需求:Nexus 置信度输出（来自 multi-agent-pipeline 的 nexus 步骤）

Nexus 步骤的 LLM Prompt MUST 要求输出 `confidence_label`（定性标签：极高/高/中/低/极低），禁止直接输出 0-100 数值。后端拦截层 SHALL 将 `confidence_label` 查表映射为基准分，执行梯度扣分或 ERROR 熔断后，将最终数值写回 `confidence_level` 字段。

#### 场景:Nexus 输出标签被映射为基准分
- **当** Nexus LLM 返回 `confidence_label: "高"`
- **那么** 后端查表得到基准分 70

#### 场景:基准分经扣分后写回
- **当** 基准分 70，存在 1 个 TOPOLOGY_LOOP WARNING
- **那么** 最终 `confidence_level = 65`，并写入 `steps.nexus.confidence_level`

#### 场景:ERROR 触发强制覆写
- **当** 静态校验存在 ERROR
- **那么** `confidence_level` MUST 被强制设置为 `Math.min(original, 45)`
