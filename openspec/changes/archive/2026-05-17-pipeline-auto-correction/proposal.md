## 为什么

当前管线完成后，`build-model` 的结果直接展示给用户，4 轮对抗性审查的意见仅作为"旁白"参考，不会回写修正模型。当 nexus 判定置信度 < 60% 时，说明模型存在重大疑问，但用户仍需手动重新建模才能获得改进版本。这降低了管线的实用价值——用户花了 5-6 次 LLM 调用，却得到了一个被标记为"存疑"的结果。

## 变更内容

- **新增内回路（Inner Loop）**：在 build-model 与 devil-model 之间建立自动校准机制。devil-model 强制输出结构化修正指令，后端通过纯 JS `sanitizeDevilReview` 函数进行协议防御校验，当 `requires_refactor: true` 且 `severity: "CRITICAL"` 时，管线原地回溯至 build-model 重新建模。内回路最多执行 1 次。
- **新增外回路（Outer Loop）**：nexus 置信度 < 60% 时，从 build-model 开始执行裁剪版 3 步重跑（build-model → MonteCarlo → nexus，跳过 4 个 Devil 步骤），将精炼后的"败因上下文"注入 build-model prompt。外回路最多执行 1 次。
- **手动调参修正**：收敛为纯本地/轻量仿真重算，不走后端长管线，秒级响应。
- **新增 `/correct-model` API 路由**：供手动修正调用（独立单步动作）。
- **动态 loading 文案**：根据管线阶段（正常推演 / 内回路校准 / 外回路重塑）显示不同的 loading 提示文案，提升用户对系统行为的感知。

## 功能 (Capabilities)

### 新增功能
- `model-correction`: 基于对抗审查意见的自适应双回路修正管线（内回路原子校准 + 外回路置信度熔断重塑）

### 修改功能
- `decision-core`: 管线新增内回路/外回路逻辑；前端 runPipeline 需处理回路重跑后的模型替换

## 影响

- `server/routes/decision.js` — executePipelineSteps 实现内回路回溯 + 外回路裁剪版重跑；纯 JS `sanitizeDevilReview` 校验；新增 `/correct-model` 路由
- `server/prompts/decisionModel.js` — devil-model prompt 增加结构化修正指令输出；新增外回路 build-model prompt
- `src/composables/useDecisionModel.js` — runPipeline 处理回路重跑状态更新
- `src/api/decision.js` — 新增 correctModel API
- `src/components/decision/PipelineProgress.vue` — 显示内回路/外回路状态及 V1→V2 进化过程

## 非目标

- 不实现多轮循环修正（内/外回路各最多 1 次）
- 外回路不从 framework 开始重跑
- V2 重跑不执行 Devil 审查步骤（裁剪为 3 步）
- 手动调参不触发后端长管线（纯本地计算）
