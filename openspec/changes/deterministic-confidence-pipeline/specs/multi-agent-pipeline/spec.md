# Spec: multi-agent-pipeline

## 修改需求

### 需求:Nexus 步骤的 LLM 输出契约

Nexus 步骤的 Prompt SHALL 要求 LLM 输出 `confidence_label`（定性标签：极高/高/中/低/极低），禁止直接输出 0-100 数值。`confidence_score` 字段由后端代码查表并计算后覆写。

#### 场景:Nexus 输出定性标签
- **当** Nexus LLM 生成最终决策报告
- **那么** 返回 JSON 中 MUST 包含 `confidence_label` 字段，值为 "极高"、"高"、"中"、"低" 或 "极低"

#### 场景:Nexus 禁止输出数值分
- **当** Nexus LLM 生成最终决策报告
- **那么** 返回 JSON 中的 `confidence_score` 字段 MUST 为 0 或不包含（由后端代码注入真实数值）
