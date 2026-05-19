## 为什么

当前 build-model 步骤使用单次 LLM 调用（`DECISION_MODEL_PROMPT` 约 120 行）输出完整的定量决策模型。当 LLM 处理如此长的提示词时，容易发生"认知过载"——为照顾复杂 JSON 格式而在推理上偷懒（如敷衍概率归一化、trade_offs 维度不匹配），且约 5% 的概率出现 JSON 格式崩溃。

## 变更内容

将 build-model 从单次 LLM 调用重构为 SEE（Sequential Elaborate Evaluation）序列化渐进推演子管线，保持 pipeline 外层结构不变。具体包括：

- **SEE Step 1（变量与参数细化）**：基于 Framework 输出量化变量、权重、仿真分布参数
- **SEE Step 2（因果树推演）**：构建分层因果决策树及节点逻辑载荷
- **SEE Step 3（路径演绎与推荐）**：打平路径、定量评分、文字推荐
- **代码 Parser（替代第 4 步 LLM）**：将 Markdown DSL 中间格式转换为目标 JSON Schema
- **内循环精确弹回**：按 `target_step` 分类审查意见，定点局部重试 + 级联顺延
- **外循环全局重塑**：从 Step 1 完整重跑 SEE 子管线
- **pipelineState 分步持久化**：每步 raw_text + parsed_json + status + version

此变更不改变 `/api/decision/full-pipeline` 的接口契约和 SSE 流格式。

## 功能 (Capabilities)

### 新增功能
- `see-sub-pipeline`: SEE 子管线的 3 个 LLM 步骤（变量提取、因果树推演、路径演绎）及 Markdown DSL 中间格式规范
- `see-parser`: 代码 Parser，将 SEE 中间格式转换为目标 JSON Schema，含容错解析
- `see-rollback-strategy`: 内循环精确弹回 + 外循环全局重塑的状态管理与级联刷新机制

### 修改功能
- `pipeline-engine`: build-model 从单次 LLM 调用变为 SEE 子管线编排，内循环从回溯 build-model 变为精确弹回 SEE 子步
- `multi-agent-pipeline`: pipeline 步骤定义从 8 步扩展为 SEE 子步，但对外暴露的管线步骤名称和 SSE 事件格式不变
- `model-validator`: validateModel 的触发时机从 build-model 后移至 SEE Parser 组装完成后

## 非目标

- 不改变 framework（Step 0）的输出格式和职责
- 不修改 devil-model、simulate、nexus 等后续步骤的逻辑
- 不改变客户端 SSE 消费逻辑和 localStorage 持久化格式
- 不涉及前端 UI 变更

## 影响

- **后端**：`server/routes/decision.js` 管线编排逻辑、`server/prompts/decisionModel.js` 新增 3 个 SEE prompt
- **新增**：`server/parsers/seeParser.js`（代码 Parser）
- **共享**：`src/shared/modelValidator.js` 触发时机调整
- **状态管理**：`pipelineState` 结构扩展（分步持久化字段）
