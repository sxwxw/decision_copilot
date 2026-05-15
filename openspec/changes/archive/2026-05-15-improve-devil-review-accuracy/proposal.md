## 为什么

DEVIL 对抗性审查接口传给 LLM 的上下文过于稀疏——变量仅传名称列表（`["短期营收","产品壁垒"...]`），缺少 `sim_spec`、`weights`、`trade_offs` 和 `scores` 的完整信息。这导致 LLM 虚构了"变量列表全为 null"等不实指控，削弱了审查结果的可信度。

## 变更内容

- 扩充 `/devil` 接口传给 LLM 的 user prompt，包含完整的变量信息（名称、分布类型、权重）和选项的 trade_offs 摘要
- 在 DECISION_DEVIL_PROMPT 中增加约束：禁止虚构模型中不存在的缺失数据，所有指控必须基于传入数据
- 前端 `devilReview` API 调用已传完整 currentModel，无需修改

## 功能 (Capabilities)

### 新增功能

无新增功能。

### 修改功能

- `devil-review`: DEVIL 审查的输入上下文更完整，LLM 需基于实际数据进行审查而非推测
- `devils`: 流水线中 `devils` 步骤的 userPrompt 构造同样需要补充完整模型信息

## 影响

- 后端：`server/routes/decision.js`（/devil 路由 + executePipelineSteps 中 devils 步骤）
- Prompt：`server/prompts/decisionModel.js`（DECISION_DEVIL_PROMPT）
- 非目标：不改变蒙特卡洛仿真逻辑，不改变变量定义结构，不涉及前端 UI 变更
