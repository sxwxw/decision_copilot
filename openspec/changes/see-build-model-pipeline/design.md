## 上下文

当前 `build-model` 步骤通过单次 `DECISION_MODEL_PROMPT`（约 120 行、含完整 JSON Schema）一次性输出完整的定量决策模型。LLM 在面对如此长且密集的提示词时，容易发生"认知过载"——为照顾复杂 JSON 格式而在推理上偷懒，且约 5% 概率出现 JSON 格式崩溃。

## 目标 / 非目标

**目标：**
- 将 build-model 拆分为 3 个 LLM 子步 + 1 个代码 Parser（SEE 架构），每次只思考一件事
- 使用 Markdown DSL 中间格式，确保 LLM 友好且代码可精准解析
- 支持内循环精确弹回（按 target_step 分类，不重跑整个 SEE）
- 外循环全局重塑（Nexus 置信度 < 60 时从 Step 1 完整重跑）
- 保持 pipeline 外层 SSE 流格式和接口契约不变

**非目标：**
- 不修改 framework（Step 0）、devil-model（Step 3）、simulate、nexus 等后续步骤的逻辑
- 不改变前端 SSE 消费、localStorage 格式、treeData 结构
- 不引入新的外部依赖

## 决策

### 1. 中间格式：Markdown DSL vs 纯 JSON

**选择 Markdown DSL**（`## VARIABLES_START ##`、`[PAYLOAD]`、缩进层级树）。

**理由**：纯 JSON 要求 LLM 同时处理推理推理和格式闭合，这正是当前问题的根源。Markdown DSL 对 LLM 的续写本能友好，同时对正则/行扫描解析器也极其友好。第 4 步 Parser 用代码实现，确定性 100%，消除 JSON 崩溃概率。

### 2. 子步编排：串行 vs 并行

**选择串行**（Step 1 → Step 2 → Step 3）。因果树依赖 Step 1 的变量名，路径依赖 Step 2 的树结构，天然有数据流依赖，无法并行。

### 3. 内循环回退策略

**精确弹回 + 级联顺延**（步索引驱动，不引入独立 frozen/stale 状态机）：

- `target_step=1`（权重/变量问题）：`fromStepIdx=0` 重跑 Step 1 → 顺延 Step 2 → 顺延 Step 3
- `target_step=2`（因果树问题）：`fromStepIdx=1`，Step 1 已有数据不变，重跑 Step 2 → 顺延 Step 3
- `target_step=3`（路径/推荐问题）：`fromStepIdx=2`，Step 1+2 数据不变，仅重跑 Step 3

**理由**：复用现有 `executePipelineSteps` 的 `fromStepIdx` 参数模式，不需要额外引入 frozen/stale 状态机，降低状态管理复杂度。

### 4. 管线断裂防护

**保持现有 build-model 的"写入位置和输出形状"不变**：只改 build-model 的"生成方式"（单次 LLM → SEE 子管线），不改它的写入位置（`pipelineState.steps['build-model']`）和下游逻辑（devil-model 审查、validateModel、simulate）。即使 SEE 内部有问题，管线不会断裂——最坏情况是 validateModel 报错触发内循环。

### 5. SSE 兼容性

客户端 SSE 消费（useDecisionModel.js:629-634）使用 if/else 链，无 default 分支。新增 `see-step-running` / `see-step-completed` 事件类型会被静默跳过，**天然安全**。无需修改客户端代码。

### 6. 持久化粒度

每个 SEE 子步独立存储 `raw_text`（LLM 原始输出）和 `parsed_json`（Parser 转换后的局部 JSON 片段）到 `pipelineState`，用于断点恢复（resume）。

### 7. Parser 容错策略

Parser 不依赖精确空格数，使用正则匹配关键字（`- Variable:`、`- Option:`、`[PAYLOAD]` 等）而非缩进深度。对行首空格做 trim 容忍。

## 风险 / 权衡

| 风险 | 缓解措施 |
|---|---|
| SEE 增加 LLM 调用次数（1→3），延迟和成本增加 | 内循环精确弹回可减少回退时调用次数（最坏 3 次，最优 1 次） |
| LLM 不遵循 Markdown DSL 格式 | Parser 做容错解析 + Devil-model 审查兜底 + validateModelStructure 结构校验拦截 |
| 中间文本格式与 JSON Schema 映射不完整 | 在细化方案中已定义完整 DSL，Parser 按契约映射 |
| pipelineState 膨胀 | 仅存储必要的 raw_text 和 parsed_json，outer loop 时清理旧版本 |

## 关键日志埋点

所有关键决策点必须输出 `console.log`，便于排查问题：

```text
[SEE] Step 1 started | pipeline: {pipelineId}, version: {v}
[SEE] Step 1 completed | variables: {count}, weightSum: {sum}
[SEE] Step 2 started | pipeline: {pipelineId}, version: {v}
[SEE] Step 2 completed | treeDepth: {depth}, options: {count}, events: {count}
[SEE] Step 3 started | pipeline: {pipelineId}, version: {v}
[SEE] Step 3 completed | paths: {count}, scores: {JSON}
[SEE] Parser assembled | modelFields: {keys}
[SEE] validateModelStructure passed | treeData: ok, paths: ok, enums: ok
[SEE] validateModelStructure FAILED | error: {message} → 中断管线
[SEE] Inner loop rollback | target_step: {1|2|3}, reason: {devilDirective}
[SEE] Inner loop cascade | fromStepIdx: {idx}, staleSteps: [2,3]
[SEE] Outer loop reshuffle | outerLoopCount: {n}, defeatContext: {summary}
[SEE] Sub-pipeline completed | totalLLMCalls: {n}, elapsed: {ms}
```
