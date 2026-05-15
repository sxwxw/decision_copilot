## 为什么

`transform-pipeline-to-deep-validation` 变更将深度验证实现为单次 LLM 调用（`/deep-validation` → `DECISION_VALIDATE_PROMPT`），但深度验证作为"深入探索已有模型"的核心能力，理应复用多 Agent 流水线 5 步渐进式校验架构（FRAMEWORK → MODEL-BUILD → SIMULATE → DEVIL → NEXUS），而非一次性生成。用户在"快速建模 → 调参"后选择深度验证，期望看到的是与多 Agent 流水线同样严谨的多步校验结果，而非一个简化版的单步 LLM。

## 变更内容

- 修改 `/deep-validation` 路由：不再单次调用 LLM，改为复用 `/full-pipeline` 的 5 步流水线，但传入 `currentModel` 作为每一步的上下文约束
- 扩展各 Agent prompt，支持可选的 `currentModel` 输入，使其在已有模型基础上深化而非从零开始
- NEXUS 步骤融合流水线结果与已有模型，保持 options/weights 不变
- 前端 `runDeepValidation()` 改为调用 `runPipeline()`（SSE 流式 5 步），复用已有的 PipelineProgress 组件
- 移除不再需要的 `/deep-validation` 路由和 `DECISION_VALIDATE_PROMPT`

## 功能 (Capabilities)

### 新增功能

- `deep-validation-pipeline`: 基于已有模型的 5 步流水线深度验证，SSE 流式推送进度

### 修改功能

- `deep-validation`: 从单步 LLM 调用改为 5 步流水线实现，行为从"LLM 补全模型"变为"渐进式多 Agent 验证"
- `multi-agent-pipeline`: 流水线各步骤支持可选的 `currentModel` 上下文注入，在已有模型基础上深化

## 非目标

- 不改变快速建模（`/model`）和参数调优（`/refine`）的实现
- 不改变蒙特卡洛仿真、DEVIL 审查的核心算法
- 不删除 `/full-pipeline` 接口——深度验证直接复用该端点
- 不引入 9 步流水线或 ORACLE/ECHO 社区分析

## 影响

- `server/routes/decision.js`：移除 `/deep-validation` 路由，扩展 `/full-pipeline` 支持 `currentModel` 参数
- `server/prompts/decisionModel.js`：FRAMEWORK、MODEL-BUILD、NEXUS prompt 增加可选 currentModel 输入
- `src/composables/useDecisionModel.js`：`runDeepValidation()` 改为调用 `runPipeline()`
- `src/components/decision/PipelineProgress.vue`：标题改为"深度验证"
- `server/services/llmService.js`：无变更
