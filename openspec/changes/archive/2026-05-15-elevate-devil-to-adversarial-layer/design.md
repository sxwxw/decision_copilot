## 上下文

当前流水线有 5 步：FRAMEWORK → BUILD-MODEL → SIMULATE → DEVIL → NEXUS。DEVIL 仅在最后一步运行，使用统一的 `DECISION_DEVIL_PROMPT`。用户看到的审查结果是在一切完成后才出现的，缺乏"持续怀疑"的效果。

## 目标 / 非目标

**目标：**
- 将 DEVIL 扩展为贯穿全链路的对抗层，4 个主步骤后各有对应的 DEVIL 子步骤
- 每个 DEVIL 子步骤有专用 prompt，攻击目标与其前置步骤的脆弱性匹配
- 前端进度组件展示 DEVIL 子步骤，用户能看到"系统正在质疑自己"
- 底部审查面板展示 4 个阶段的 DEVIL 输出

**非目标：**
- 不改变 `/devil` 独立接口
- 不改变蒙特卡洛仿真算法
- 不改变快速建模流程

## 决策

### 1. 流水线步骤定义

**决策**：在 `PIPELINE_STEPS` 数组中直接插入 DEVIL 子步骤，形成 9 步序列：
```
framework → devil-framework → build-model → devil-model → simulate → devil-simulate → nexus → devil-nexus
```

**理由**：最简单直接的实现方式，`executePipelineSteps` 的循环逻辑天然支持任意步骤序列，只需新增 prompt 定义和 userPrompt 构造逻辑。

**替代方案**：用嵌套结构定义主步骤+DEVIL 子步骤——增加复杂度但无实质收益。

### 2. DEVIL 步骤的 userPrompt 构造

**决策**：每个 DEVIL 步骤的 userPrompt 由其前置步骤的输出构建：
- devil-framework: 传入 FRAMEWORK 输出 + 用户原始问题
- devil-model: 传入 BUILD-MODEL 输出 + FRAMEWORK 输出
- devil-simulate: 传入蒙特卡洛结果 + 模型数据
- devil-nexus: 传入 NEXUS 输出 + 所有前面 DEVIL 步骤的累积输出

**理由**：每个 DEVIL 需要知道它要攻击什么。传入上下文让 LLM 有具体的攻击目标，而非泛泛而谈。

### 3. 4 个专用 DEVIL prompt

**决策**：在 `server/prompts/decisionModel.js` 新增 4 个 prompt：

| Prompt | 攻击目标 | 输出结构 |
|--------|---------|---------|
| DECISION_DEVIL_FRAMEWORK_PROMPT | 问题定义、选项穷举性、中间路径 | `{ questions: [...], missing_options: [...] }` |
| DECISION_DEVIL_MODEL_PROMPT | 变量选取、权重分配、因果关系、重复加权 | `{ issues: [...], biased_variables: [...] }` |
| DECISION_DEVIL_SIMULATE_PROMPT | 概率假设、均值依据、极端风险 | `{ questionable_assumptions: [...], tail_risks: [...] }` |
| DECISION_DEVIL_NEXUS_PROMPT | 结论的前提依赖、敏感性、失效条件 | `{ dependencies: [...], sensitivity: [...], failure_modes: [...] }` |

**理由**：每个阶段的攻击目标完全不同，统一 prompt 无法覆盖。专用 prompt 能更精准地引导 LLM 质疑特定类型的脆弱性。

### 4. DEVIL 结果传递到 NEXUS

**决策**：所有 DEVIL 步骤的输出存入 `pipelineState[id].steps.devil-*`，NEXUS 步骤的 userPrompt 中包含所有 DEVIL 输出作为上下文。

**理由**：NEXUS 需要知道前面所有的质疑和批评，才能生成"条件化结论"（"推荐 A，但 DEVIL-FRAMEWORK 质疑了选项穷举性，DEVIL-MODEL 发现权重偏短期..."）。

### 5. 前端展示

**决策**：在 `PipelineProgress.vue` 中，DEVIL 步骤以"🔍 审查中..."样式展示（灰色/紫色，与主步骤区分）。在 `PathDetail.vue` 底部审查面板中，按阶段分组展示 4 个 DEVIL 输出。

**理由**：用户需要感知到 DEVIL 在每个阶段都在运行，而非最后才出现。

## 风险 / 权衡

**[风险]** LLM 调用从 5 次增加到 9 次，总耗时增加约 60-80%。
**[缓解]** DEVIL 步骤使用较低 temperature、较短 max_tokens，单次调用比主步骤快；总体增加约 4 次调用但每次较短。

**[风险]** DEVIL 输出过多可能让用户觉得系统在"过度自我怀疑"。
**[缓解]** 每个 DEVIL prompt 约束最多输出 2-3 条质疑，保持精简。

**[权衡]** 9 步流水线比当前 5 步更长，用户等待时间增加。
**[理由]** 这是产品定位的核心差异化——"会怀疑自己的决策系统"。多出的等待时间本身就是"系统在认真审视"的感知价值。可以考虑后续增加"快速模式"跳过 DEVIL 步骤。
