# spec: devil-model

## 新增需求

### 需求:DEVIL-MODEL Prompt
系统必须提供 `DECISION_DEVIL_MODEL_PROMPT`，用于在 BUILD-MODEL 步骤后质疑变量、权重和因果关系。

#### 场景:Prompt 攻击目标
- 当 LLM 接收 BUILD-MODEL 输出
- 那么 Prompt 必须要求检查"变量选取是否遗漏关键维度"
- 那么 Prompt 必须要求检查"权重分配是否存在重复加权（高度相关的变量被分别赋高权重）"
- 那么 Prompt 必须要求检查"变量命名是否带有乐观/悲观倾向（如'用户增长率'vs'获客成本'）"
- 那么 Prompt 必须要求检查"因果关系是否合理（A 是否真的影响 B）"

### 需求:DEVIL-MODEL 输出结构
DEVIL-MODEL 必须返回以下 JSON 结构：

#### 场景:审查结果格式
- 当 DEVIL-MODEL 完成
- 那么必须返回 `{ "issues": [...], "biased_variables": [...], "double_weighting": [...] }`
- 其中 `issues` 是变量/权重/因果问题列表（至少 1 条，最多 3 条）
- 其中 `biased_variables` 是命名带有倾向性的变量列表
- 其中 `double_weighting` 是疑似重复加权的变量对

### 需求:DEVIL-MODEL 约束
DEVIL-MODEL 必须遵守以下约束：

#### 场景:约束遵守
- 当 LLM 生成 DEVIL-MODEL 输出
- 那么禁止 Markdown 格式，必须返回纯净 JSON
- 那么禁止脱离模型实际数据的泛泛批评
- 那么 severity 只能是 "high" | "medium" | "low"
