## 上下文

`/devil` 接口和流水线 `devils` 步骤在构造 LLM 输入 prompt 时，仅传入了变量名称列表（`variables.map(v => v.name)`）和基本的 options/scores/weights，缺少变量的分布定义、选项的 trade_offs 详情等关键上下文。LLM 在信息不足的情况下虚构了"变量缺失"等指控。

## 目标 / 非目标

**目标：**
- 让 DEVIL prompt 包含完整的变量定义（名称 + 分布类型 + 权重）
- 让 DEVIL prompt 包含选项的 trade_offs 摘要
- 在 prompt 中增加约束，禁止 LLM 虚构数据缺失
- 同步修复 `/devil` 路由和流水线 `devils` 步骤

**非目标：**
- 不改变蒙特卡洛仿真逻辑或默认回退分布
- 不修改精简版 prompt 的 sim_spec 输出要求（那是另一个变更）
- 不涉及前端 UI 变更

## 决策

**1. 变量信息以 `name + sim_spec.type + weight` 格式传入**

考虑过传入完整变量对象，但 sim_spec.params 对审查无实际价值。审查 LLM 需要知道的是：变量有什么分布类型（uniform vs beta 暗示不同的确定性水平）、权重是多少。trade_offs 需要从 treeData.children 中提取。

格式示例：
```
- 变量: [{name, weight, sim_spec_type}, ...]
- 选项 trade_offs: [{option_name, dimensions: [{name, delta}]}, ...]
- 基准分: {optionName: score}
```

**2. 在 DECISION_DEVIL_PROMPT 中增加"禁止虚构"约束**

新增一条硬约束：所有指控必须基于传入的实际数据，不得声称变量或数据不存在。如果变量缺少 sim_spec，可以指出"缺少分布定义"，但不能说"变量列表为空"。

**3. 流水线 devils 步骤使用与 /devil 路由相同的 prompt 构造逻辑**

当前两者各自独立构造，容易再次不同步。改为在 `executePipelineSteps` 中复用 `/devil` 路由的构造逻辑，或直接提取为一个共享函数。

## 风险 / 权衡

- [风险] 更长的 prompt 可能增加 token 消耗和响应延迟 → 缓解：只传审查必需的字段（name + type + weight），不传完整 sim_spec.params
- [风险] LLM 仍可能虚构，prompt 约束不是强制的 → 缓解：这是我们能做的最佳手段，彻底解决需要后处理校验审查结果
