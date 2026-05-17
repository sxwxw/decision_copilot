## 上下文

当前系统有两条建模路径：
1. **快速建模**：`InputPanel` 提交 → `onSubmit` → `buildModel()` → 单次 LLM 调用生成模型
2. **深度验证**：点击"深度验证"按钮 → `runDeepValidation()` → `runPipeline(currentModel)` → 8 步管线（含 4 轮对抗审查）

管线已在 `server/routes/decision.js` 的 `/full-pipeline` SSE 端点和 `useDecisionModel.js` 的 `runPipeline` 中完整实现。但存在两个问题：

- 用户默认进入快速建模（质量较低），管线隐藏在二级入口
- `simulate` 步骤被跳过，蒙特卡洛由前端补执行，导致 devil-simulate 和 nexus 拿不到真实仿真结果进行审查和置信度评估

## 目标 / 非目标

**目标：**

- InputPanel 提交直接触发管线，移除 `buildModel` 快速建模路径
- 移除"深度验证"按钮（管线已为默认，无需独立入口）
- 将蒙特卡洛仿真移入后端 `simulate` 步骤，使 devil-simulate/nexus 消费真实仿真结果
- 清理 `useDecisionModel.js` 中 `buildModel` 及相关导入
- 管线失败时明确报错，不降级

**非目标：**

- 不改变管线内部 LLM 步骤的 prompt 内容或 SSE 流式机制
- 不改变后端独立路由 `/framework`、`/build-model`（保留用于开发调试）

## 决策

### 1. 保留 `buildModel` 函数还是移除？

**选择：移除 `buildModel`。** 管线 quick-build 模式完全覆盖了快速建模的功能。保留两个建模入口只会增加维护负担和歧义。

### 2. 蒙特卡洛仿真放在后端还是前端？

**选择：后端执行。** 理由：

- 蒙特卡洛是纯 JS 计算（`simulator.js` 的 `runMonteCarlo`），无外部依赖
- 管线是 SSE 单向流，前端无法回推结果给后端。唯一的方式是后端自己执行
- devil-simulate 和 nexus 需要 P50/P90/sigma 等量化指标，这些只在蒙特卡洛完成后才有
- 后端执行后，结果存入 `pipelineState.steps.simulate`，后续步骤直接读取

具体做法：在 `executePipelineSteps` 的 `simulate` 分支中，复用 `src/utils/simulator.js` 的计算逻辑。由于后端是 Node.js（CommonJS），需要确保 `simulator.js` 可被 ES Module 的 `decision.js` 正确 import（当前 `useDecisionModel.js` 已能 import，说明模块兼容没问题）。

### 3. 管线 loading 状态复用

**选择：复用 `state.loading`。** 管线已经使用 `state.loading` 控制全局 loading 遮罩（`DecisionView.vue` 的 `v-loading`），`PipelineProgress` 组件提供细粒度进度条。无需额外状态。

### 4. InputPanel 的 submit 事件签名不变

**选择：保留 `emit('submit', text, riskPreference)` 签名。** DecisionView 中 `onSubmit` 改为调用 `runPipeline()` 而非 `buildModel()`。InputPanel 无需感知底层走管线还是单次建模。

### 5. 风险偏好参数的处理

管线 `runPipeline` 不接收 riskPreference 参数，但后端的蒙特卡洛需要风险偏好。在 `onSubmit` 中先设置 `state.riskPreference`，前端 `runPipeline` 将 riskPreference 通过请求体传给后端（当前 `full-pipeline` 接口只传 `userInput` 和 `currentModel`，需要扩展）。

### 6. 前端蒙特卡洛展示

管线完成后，前端从 `data.steps.simulate` 读取蒙特卡洛结果，同时赋值给 `state.monteCarloResult`，确保 UI 展示不受影响。

### 7. 移除 `runDeepSimulation` 避免重复执行

**选择：完全移除 `runDeepSimulation`。** 当前管线完成后前端会调用 `runDeepSimulation()`（[useDecisionModel.js:501](src/composables/useDecisionModel.js#L501)），该函数内部：

- 再次在前端执行 `runMCFromModel()`（与后端 simulate 步骤重复）
- 再次调用 `runDevilReview()`（与管线内的 4 轮 devil 步骤重复）

这导致蒙特卡洛跑两次、对抗审查跑两次，状态互相覆盖。蒙特卡洛后端化后，`runDeepSimulation` 的所有职责已由管线覆盖，必须移除。

## 风险 / 权衡

**[延迟体验]** 管线串行 7 步（含 simulate 计算），冷启动可能比快速建模慢 5-10 倍 → 缓解措施：`PipelineProgress` 进度组件已存在，用户不会面对空白等待

**[API 成本]** 管线消耗 5-6 次 LLM 调用 vs 快速建模 1 次 → 接受的成本，换取结果可信度

**[调试便利性]** 移除快速建模后，调试模型输出结构需要走管线 → 后端 `/framework` 和 `/build-model` 独立路由保留，可用于开发调试

**[蒙特卡洛性能]** 5000 次采样在 Node.js 单线程中约 50-200ms，不会成为管线瓶颈
