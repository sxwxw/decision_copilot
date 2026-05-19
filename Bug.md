# Bug 记录

## BUG-001: SEE 步骤调用 callQwen 传 null 导致系统崩溃

**日期**: 2026-05-19
**文件**: `server/routes/decision.js` + `server/services/llmService.js`

### 现象

调用 full-pipeline 接口时，在 SEE Step 1 执行后立即报错：
```json
{"status":"see-step-running","text":"SEE Step 1/3: 变量与参数细化"}
{"message":"Cannot read properties of null (reading 'length')"}
```

### 根因

两处并发问题：

1. **null 传参**：`executeSeeSubPipeline` 中三个 SEE 步骤调用 `callQwen(null, prompt, ...)` 时，`systemPrompt` 为 `null`。`llmService.js:19` 中 `systemPrompt.length` 立即抛 `TypeError`。

2. **response_format 冲突**：`callQwen` 始终设置 `response_format: { type: 'json_object' }`，这会强制 LLM 只输出 JSON。但 SEE 子步骤要求输出的是 **Markdown DSL 文本**（`## VARIABLES_START ##` 等），`json_object` 模式会导致 LLM 拒绝或扭曲非 JSON 输出。

### 修复

- `llmService.js`: `callQwen` 增加 `jsonMode` 参数（默认 `true`），`jsonMode=false` 时：
  - 不设置 `response_format`
  - 不自动追加"请以JSON格式返回"提示
  - `systemPrompt` 为 `null` 时转为空字符串 `''`
- `decision.js`: SEE 三步骤改为 `callQwen('', prompt, DECISION_MODEL, 1, false, false)`（systemPrompt 为空串，jsonMode=false）

### 影响范围

仅 SEE 子管线步骤受影响。原有框架、魔鬼审查、nexus 等步骤不受影响（都传了有效 systemPrompt 且需要 JSON 输出）。

## BUG-002: SEE 完成后前端未收到 build-model completed 事件，PipelineProgress 置灰

**日期**: 2026-05-19
**文件**: `server/routes/decision.js`

### 现象

多 Agent 流水线 UI 中，建模已结束且成功（`pipelineStatus === 'completed'`），但 PipelineProgress 组件中"模型构建"步骤始终处于 pending/置灰状态，未显示为已完成的绿色勾选。

### 根因

SEE 子管线在 `executeSeeSubPipeline` 完成后通过 `continue` 跳过主循环末尾的 `sendEvent('step', { step: step.name, status: 'completed' })`（[decision.js:1129] 附近的公共发送逻辑）。前端 SSE 消费者依赖此事件将 `build-model` 加入 `pipelineCompletedSteps`，缺少它导致 UI 认为该步骤未完成。

SEE 子步骤发出的 `see-step-running` / `see-step-completed` 事件前端不解析（无 `step` 字段），不影响现有逻辑。

### 修复

在 SEE 子管线的 `continue` 之前，显式发送 `await sendEvent('step', { step: 'build-model', status: 'completed' })`。

### 影响范围

仅 SEE 子管线（USE_REAL_LLM=true 时）受影响。Mock 模式走独立分支，不受此 bug 影响。

## BUG-003: 流水线完成后，综合报告节点始终处于 active 状态

**日期**: 2026-05-19
**文件**: `server/routes/decision.js`

### 现象

建模已完成，页面数据全部展示，但左侧 PipelineProgress 组件中"综合报告"（nexus）节点始终处于 active（蓝色脉冲）状态，未变为 completed（绿色勾选）。

### 根因

在 `executePipelineSteps` 的外层循环（outer loop）逻辑中，nexus 步骤完成后的 `sendEvent('step', { step: 'nexus', status: 'completed' })` 被放在了 `if (confidence < 60 && outerLoopCount < MAX_OUTER_LOOP)` 的分支内部（[decision.js:1185] 的 `break` 之前）。当置信度 >= 60 直接通过、或 outer loop 未触发时，nexus completed 事件不会被发送，导致前端 `pipelineCompletedSteps` 缺少 `nexus`，PipelineProgress 始终判定为 active。

### 修复

将 `sendEvent('step', { step: 'nexus', status: 'completed' })` 移至 `if (step.name === 'nexus')` 块的末尾（外层循环逻辑之外），覆盖所有路径：

- 置信度达标直接通过
- 外回路重塑后达标
- 外回路达到上限仍不达标

同时在循环末尾的通用 `sendEvent('step', { step: step.name, status: 'completed' })` 增加跳过条件，避免 USE_REAL_LLM + nexus 时发送两次。

### 影响范围

仅 USE_REAL_LLM=true 时的 nexus 步骤受影响。mock 模式走 `else if (mockData)` 分支，仍由循环末尾通用逻辑发送 completed 事件，不受影响。
