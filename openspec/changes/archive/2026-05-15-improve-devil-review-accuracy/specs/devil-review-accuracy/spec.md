## 新增需求

### 需求:DEVIL 审查必须基于完整模型上下文

系统必须将完整的变量信息（名称、分布类型、权重）和选项的 trade_offs 摘要传递给 DEVIL 审查 LLM，而非仅传递变量名称列表。

#### 场景:/devil 路由传入完整变量信息
- **当** 前端调用 `POST /api/decision/devil` 接口
- **那么** userPrompt 中必须包含每个变量的名称、sim_spec.type（如有）和 weight 值

#### 场景:/devil 路由传入选项 trade_offs
- **当** 前端调用 `POST /api/decision/devil` 接口
- **那么** userPrompt 中必须包含每个选项的基准分（scores）和 trade_offs 维度及 delta 值

#### 场景:流水线 devils 步骤传入完整模型信息
- **当** 流水线执行到 `devils` 步骤
- **那么** userPrompt 构造方式必须与 `/devil` 路由保持一致，传入完整变量信息和 trade_offs

### 需求:DEVIL prompt 必须禁止虚构数据缺失

DECISION_DEVIL_PROMPT 必须明确约束 LLM 不得虚构模型中不存在的缺失数据，所有指控必须基于传入的实际数据。

#### 场景:LLM 收到禁止虚构约束
- **当** DEVIL 审查 LLM 收到 prompt
- **那么** prompt 中必须包含明确指令：所有挑战(challenge)和偏置标记(bias_flag)必须基于传入的实际数据，不得声称变量或数据不存在
