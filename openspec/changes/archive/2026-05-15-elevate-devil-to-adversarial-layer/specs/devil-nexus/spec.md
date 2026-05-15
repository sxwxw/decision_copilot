# spec: devil-nexus

## 新增需求

### 需求:DEVIL-NEXUS Prompt
系统必须提供 `DECISION_DEVIL_NEXUS_PROMPT`，用于在 NEXUS 步骤后生成条件化结论。

#### 场景:Prompt 攻击目标
- 当 LLM 接收 NEXUS 输出和前面所有 DEVIL 步骤的累积输出
- 那么 Prompt 必须要求识别"结论依赖哪些前提条件"
- 那么 Prompt 必须要求识别"结论对哪些变量最敏感"
- 那么 Prompt 必须要求识别"在什么情况下结论会失效（排名翻转）"
- 那么 Prompt 必须要求综合前面所有 DEVIL 步骤的质疑，评估其对结论的影响

### 需求:DEVIL-NEXUS 输出结构
DEVIL-NEXUS 必须返回以下 JSON 结构：

#### 场景:审查结果格式
- 当 DEVIL-NEXUS 完成
- 那么必须返回 `{ "dependencies": [...], "sensitivity": [...], "failure_modes": [...], "confidence": "<高|中|低>" }`
- 其中 `dependencies` 是结论依赖的前提条件列表（至少 1 条，最多 3 条）
- 其中 `sensitivity` 是结论最敏感的变量/参数列表
- 其中 `failure_modes` 是结论失效的条件列表（"当 X 发生时，推荐方案变为 Y"）
- 其中 `confidence` 是对整体结论的信心水平

### 需求:DEVIL-NEXUS 约束
DEVIL-NEXUS 必须遵守以下约束：

#### 场景:约束遵守
- 当 LLM 生成 DEVIL-NEXUS 输出
- 那么禁止 Markdown 格式，必须返回纯净 JSON
- 那么禁止简单重复前面 DEVIL 步骤的结论，必须综合分析
- 那么每条 failure_mode 必须包含具体的失效条件和替代结果
