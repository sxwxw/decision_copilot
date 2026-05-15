## 上下文

前 8 个 OpenSpec 变更迭代中累积了 4 个已确认缺陷：
- P0: PathDetail.vue 中 `state` 变量未声明，导致敏感性分析 Tab 白屏
- P1: 流水线步数前后端不一致（前端 5 步 vs 后端 4 步）
- P1: `/pipeline/:id/resume` 断点续跑接口为状态空壳，不调用 LLM
- P2: 清除缓存按钮无确认弹窗和成功提示

## 目标 / 非目标

**目标：**
- 修复 4 个缺陷，使所有已交付功能可正常使用
- 保持最小化改动范围，不引入新架构

**非目标：**
- 不做服务端持久化改造（内存 `pipelineState` 保留现状）
- 不重新设计流水线架构
- 不改写蒙特卡洛仿真引擎

## 决策

### 1. PathDetail.vue 的 `state` 引用修复

**方案：在 props 中新增 `sensitivity` prop，由 DecisionView 透传**

- 不改用 `useDecisionModel()` 导入，因为 PathDetail 是被 DecisionView 调用的子组件，状态应由父组件单向传入
- 在 PathDetail props 中新增 `sensitivity: { type: Object, default: null }`
- 模板中 `:sensitivity="state.model?.sensitivity ?? null"` 改为 `:sensitivity="sensitivity"`
- DecisionView.vue 中给 PathDetail 增加 `:sensitivity="state.model?.sensitivity ?? null"`

### 2. 流水线步数对齐

**方案：后端 pipelineSteps 增加 `simulate` 步骤**

- 后端 `server/routes/decision.js` 的 `pipelineSteps` 数组增加 `{ name: 'simulate', ... }`，位置在 `build-model` 之后、`devils` 之前
- `simulate` 步骤的 prompt 为：传入 build-model 的结果和当前参数，调用 Monte Carlo 仿真端点（但因为是 pipeline 内执行，直接复用已有的 `runMonteCarlo` 逻辑即可）
- 实际上 simulate 步骤在 pipeline 中不需要调用 LLM，只需标记 completed 即可（仿真由前端在模型加载后自行触发）
- 前端 PipelineProgress.vue 的 steps 数组已是 5 步，无需修改

**替代方案考虑：** 移除前端的 simulate 步骤 — 拒绝，因为多 Agent 流水线的概念完整性要求 simulate 作为独立步骤存在。

### 3. 断点续跑真实执行

**方案：resume 接口从断点处继续调用 LLM**

- 当前 resume 逻辑仅更新状态标记，改为：从 `lastStep` 的下一个步骤开始，循环调用 `callQwen`
- 复用 `/full-pipeline` 中已有的步骤循环逻辑，提取为共享函数
- 由于 `pipelineState` 是内存存储，服务器重启后数据丢失属于已知行为，不在此变更中处理

**风险：** 提取共享函数可能影响 `/full-pipeline` 的现有行为 → 缓解：将循环逻辑抽取为 `executePipelineSteps()` 函数，两个路由都调用它

### 4. 清除缓存确认

**方案：ParamPanel.vue 中改用 `ElMessageBox.confirm`**

- 点击清除缓存时弹出确认框
- 确认后调用 `emit('clearCache')`，成功时显示 `ElMessage.success`

## 风险 / 权衡

[风险] → simulate 步骤在 pipeline 中不实际运行蒙特卡洛仿真，只是占位
→ 缓解：simulate 步骤的 completed 事件携带模拟结果占位，前端收到后自行触发真实仿真

[风险] → 断点续跑在服务重启后丢失数据
→ 缓解：属于架构级问题（需要持久化存储），不在本次 bugfix 范围内
