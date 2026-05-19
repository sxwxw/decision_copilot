# Spec: see-sub-pipeline

## 新增需求

### 需求:SEE Step 1 — 变量与参数细化

系统 SHALL 支持将 Framework 的定性维度转换为量化变量与仿真参数。此步骤接收用户问题和 Framework JSON，输出 Markdown DSL 格式的变量、权重和分布参数。

#### 场景:基于 Framework 生成变量
- **当** 接收到有效的 userInput 和 framework 输出（含 options、dimensions、key_tradeoffs、risk_factors）
- **那么** 系统调用 LLM 生成 `## VARIABLES_START ##` 到 `## VARIABLES_END ##` 之间的 Markdown DSL 文本

#### 场景:变量名称与 Framework 维度一致
- **当** Step 1 生成变量
- **那么** 每个 Variable 名称必须与 Framework 中的 dimension.name 逐字完全一致

#### 场景:权重总和归一化约束
- **当** Step 1 生成权重
- **那么** 所有 Weight 值之和必须接近或等于 1.0

#### 场景:sim_spec 参数与分布类型匹配
- **当** Step 1 生成仿真参数
- **那么** SimSpecParams 必须与 SimSpecType 匹配的 key（如 normal 需要 mean 和 sd，lognormal 需要 mu 和 sigma）

### 需求:SEE Step 2 — 因果树推演

系统 SHALL 支持构建分层因果决策树。此步骤接收 Framework JSON 和 Step 1 输出，输出 Markdown 缩进树格式（`-` 列表 + `[PAYLOAD]` 块）。

#### 场景:基于变量构建树结构
- **当** 接收到 Framework JSON 和 Step 1 输出
- **那么** 系统调用 LLM 生成 Root → Option → L1 Event → L2 State 的 Markdown 缩进树

#### 场景:选项节点名称与 Framework 一致
- **当** Step 2 生成 Option 节点
- **那么** Option 名称必须与 Framework 中的 options 逐字完全一致

#### 场景:每个选项下有正负分叉
- **当** Step 2 生成分叉事件
- **那么** 每个 Option 下必须且仅有 2 个 L1 事件（一个 positive 倾向，一个 negative 倾向）

#### 场景:每个节点包含逻辑载荷
- **当** Step 2 生成非叶子节点
- **那么** 必须在 `[PAYLOAD]` 块中包含 key_impact、risk_level、primary_reason、opportunity_cost、trade_off、risk_adjustment 字段

#### 场景:终局状态带概率标签
- **当** Step 2 生成 L2 终局状态
- **那么** 必须附加 probability_label（极高/高/中/低/极低）

### 需求:SEE Step 3 — 路径演绎与推荐

系统 SHALL 支持将因果树打平为完整路径，并输出定量评分和文字推荐。此步骤接收 Step 1 和 Step 2 输出。

#### 场景:路径打平
- **当** 接收到 Step 1 和 Step 2 输出
- **那么** 系统调用 LLM 生成 `## PATHS_START ##` 到 `## PATHS_END ##` 之间的路径列表

#### 场景:概率归一化
- **当** Step 3 生成路径概率
- **那么** 同一 Option 下的所有路径的 probability_label 映射为数值后，总和必须严格等于 1.0

#### 场景:时间线包含影响和阈值
- **当** Step 3 生成路径时间线
- **那么** 每个 TimelineEvent 必须包含 Impact（变量名:数值）和 Threshold（变量名:阈值0-100）

#### 场景:评分输出
- **当** Step 3 完成
- **那么** 必须生成 `## SCORES_START ##` 到 `## SCORES_END ##` 之间的各选项得分（0-100）

#### 场景:推荐文本输出
- **当** Step 3 完成
- **那么** 必须生成 `## RECOMMENDATION_START ##` 到 `## RECOMMENDATION_END ##` 之间的综合分析文本（150 字以内）

### 需求:SEE SSE 状态广播

系统 SHALL 在 SEE 子管线执行期间，向 SSE 客户端发送细粒度的进度事件，保持与现有 SSE 格式兼容。

#### 场景:SEE 子步骤开始
- **当** SEE 子步骤开始执行
- **那么** 系统发送 `event:status` 事件，status 字段为 `"see-step-running"`，text 字段包含子步骤名称

#### 场景:SEE 子步骤完成
- **当** SEE 子步骤完成
- **那么** 系统发送 `event:status` 事件，status 字段为 `"see-step-completed"`，text 字段包含子步骤名称
