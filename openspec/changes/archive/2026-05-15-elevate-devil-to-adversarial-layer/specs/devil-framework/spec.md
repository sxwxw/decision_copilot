# spec: devil-framework

## 新增需求

### 需求:DEVIL-FRAMEWORK Prompt
系统必须提供 `DECISION_DEVIL_FRAMEWORK_PROMPT`，用于在 FRAMEWORK 步骤后质疑问题定义和选项穷举性。

#### 场景:Prompt 攻击目标
- 当 LLM 接收 FRAMEWORK 输出
- 那么 Prompt 必须要求质疑"问题是否被正确框架化"
- 那么 Prompt 必须要求检查"是否存在被忽略的中间路径或第三选择"
- 那么 Prompt 必须要求质疑"二元/多选框架是否人为限制了思考空间"

### 需求:DEVIL-FRAMEWORK 输出结构
DEVIL-FRAMEWORK 必须返回以下 JSON 结构：

#### 场景:审查结果格式
- 当 DEVIL-FRAMEWORK 完成
- 那么必须返回 `{ "questions": [...], "missing_options": [...], "reframe_suggestions": [...] }`
- 其中 `questions` 是对问题定义本身的质疑（至少 1 条，最多 3 条）
- 其中 `missing_options` 是可能被忽略的中间路径或替代方案
- 其中 `reframe_suggestions` 是如何重新框架化问题的建议

### 需求:DEVIL-FRAMEWORK 约束
DEVIL-FRAMEWORK 必须遵守以下约束：

#### 场景:约束遵守
- 当 LLM 生成 DEVIL-FRAMEWORK 输出
- 那么禁止 Markdown 格式，必须返回纯净 JSON
- 那么禁止泛泛而谈的批评，每条质疑必须引用 FRAMEWORK 输出的具体内容
- 那么 severity 只能是 "high" | "medium" | "low"
